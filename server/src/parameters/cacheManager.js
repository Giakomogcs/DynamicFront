/**
 * Smart cache with auto-reset and garbage collection
 * Evita ficar com dados obsoletos ou sem sentido
 */
class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 3600000; // 1 hour default
        this.cache = new Map();
        this.metadata = new Map(); // timestamps + hit count
        this.startGarbageCollection();
    }

    /**
     * Get cached inference result
     * @param {string} toolId
     * @param {string} objective
     * @returns {Object|null}
     */
    get(toolId, objective) {
        const key = this._generateKey(toolId, objective);
        const entry = this.cache.get(key);

        if (!entry) return null;

        const meta = this.metadata.get(key);
        const age = Date.now() - meta.timestamp;

        // Check if expired
        if (age > this.ttl) {
            this.cache.delete(key);
            this.metadata.delete(key);
            return null;
        }

        // Update hit count
        meta.hits++;
        meta.lastAccess = Date.now();

        return entry;
    }

    /**
     * Set cache entry
     */
    set(toolId, objective, result, ttl = null) {
        // Check if cache is full
        if (this.cache.size >= this.maxSize) {
            this._evictLRU();
        }

        const key = this._generateKey(toolId, objective);
        this.cache.set(key, result);

        this.metadata.set(key, {
            timestamp: Date.now(),
            ttl: ttl || this.ttl,
            hits: 0,
            lastAccess: Date.now()
        });
    }

    /**
     * Reset specific cache entries
     * Caso não faça mais sentido os dados
     */
    reset(filter = null) {
        if (!filter) {
            // Reset all
            this.cache.clear();
            this.metadata.clear();
            console.log('🗑️ Cache completely cleared');
            return;
        }

        // Reset by filter
        let cleared = 0;
        for (const [key, value] of this.cache) {
            if (filter(key, value)) {
                this.cache.delete(key);
                this.metadata.delete(key);
                cleared++;
            }
        }
        console.log(`🗑️ Cleared ${cleared} cache entries`);
    }

    /**
     * Reset cache for specific tool
     */
    resetTool(toolId) {
        this.reset((key) => key.startsWith(`${toolId}:`));
    }

    /**
     * Reset old entries
     */
    resetOldEntries(ageMs = this.ttl) {
        const now = Date.now();
        this.reset((key) => {
            const meta = this.metadata.get(key);
            return (now - meta.timestamp) > ageMs;
        });
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const stats = {
            size: this.cache.size,
            maxSize: this.maxSize,
            memoryUsage: this._estimateMemory(),
            entries: []
        };

        for (const [key, meta] of this.metadata) {
            const age = Date.now() - meta.timestamp;
            stats.entries.push({
                key,
                age: age / 1000,
                hits: meta.hits,
                ttl: meta.ttl / 1000,
                expired: age > meta.ttl
            });
        }

        return stats;
    }

    // PRIVATE
    _generateKey(toolId, objective) {
        const hash = this._simpleHash(objective);
        return `${toolId}:${hash}`;
    }

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    _estimateMemory() {
        let bytes = 0;
        for (const [key, value] of this.cache) {
            bytes += key.length * 2;
            bytes += JSON.stringify(value).length;
        }
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    _evictLRU() {
        let lruKey = null;
        let lruTime = Date.now();

        for (const [key, meta] of this.metadata) {
            if (meta.lastAccess < lruTime) {
                lruTime = meta.lastAccess;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.cache.delete(lruKey);
            this.metadata.delete(lruKey);
            console.log(`🗑️ Evicted LRU entry: ${lruKey}`);
        }
    }

    startGarbageCollection() {
        this.gcInterval = setInterval(() => {
            const before = this.cache.size;
            this.resetOldEntries();
            const after = this.cache.size;

            if (before !== after) {
                console.log(`♻️ GC: removed ${before - after} expired entries`);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    stopGarbageCollection() {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
        }
    }
}

export default CacheManager;
