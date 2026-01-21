/**
 * Cache Service - Sistema de Cache Inteligente
 * Armazena resultados de ferramentas para acelerar respostas
 */

export class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0
        };
    }

    /**
     * Gera chave única baseada no nome da ferramenta e argumentos
     */
    _generateKey(toolName, args) {
        const argsHash = JSON.stringify(args || {});
        return `${toolName}:${argsHash}`;
    }

    /**
     * Obtém valor do cache se válido
     * @param {string} toolName - Nome da ferramenta
     * @param {object} args - Argumentos da ferramenta
     * @returns {object|null} Dados em cache ou null
     */
    get(toolName, args = {}) {
        const key = this._generateKey(toolName, args);
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            console.log(`[Cache] MISS: ${toolName}`);
            return null;
        }

        // Verificar se expirou
        const now = Date.now();
        if (now > entry.expiresAt) {
            console.log(`[Cache] EXPIRED: ${toolName}`);
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        console.log(`[Cache] HIT: ${toolName} (age: ${Math.round((now - entry.createdAt) / 1000)}s)`);
        return entry.data;
    }

    /**
     * Obtém valor do cache mesmo se expirado (para fallback)
     * @param {string} toolName - Nome da ferramenta
     * @param {object} args - Argumentos da ferramenta
     * @returns {object|null} Dados em cache (mesmo expirados) ou null
     */
    getStale(toolName, args = {}) {
        const key = this._generateKey(toolName, args);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        const now = Date.now();
        const age = Math.round((now - entry.createdAt) / 1000);
        console.log(`[Cache] STALE HIT: ${toolName} (age: ${age}s, expired: ${now > entry.expiresAt})`);

        return entry.data;
    }

    /**
     * Armazena valor no cache com TTL
     * @param {string} toolName - Nome da ferramenta
     * @param {object} args - Argumentos da ferramenta
     * @param {any} data - Dados a serem armazenados
     * @param {number} ttl - Time to live em milissegundos (padrão: 5min)
     */
    set(toolName, args = {}, data, ttl = 300000) {
        const key = this._generateKey(toolName, args);
        const now = Date.now();

        this.cache.set(key, {
            data,
            createdAt: now,
            expiresAt: now + ttl,
            toolName,
            args
        });

        console.log(`[Cache] SET: ${toolName} (ttl: ${ttl / 1000}s)`);
    }

    /**
     * Invalida entradas do cache por padrão
     * @param {string|RegExp} pattern - Padrão para invalidar (string ou regex)
     */
    invalidate(pattern) {
        let count = 0;

        if (typeof pattern === 'string') {
            // Invalidar por nome exato de ferramenta
            for (const [key, entry] of this.cache.entries()) {
                if (entry.toolName === pattern) {
                    this.cache.delete(key);
                    count++;
                }
            }
        } else if (pattern instanceof RegExp) {
            // Invalidar por regex
            for (const [key] of this.cache.entries()) {
                if (pattern.test(key)) {
                    this.cache.delete(key);
                    count++;
                }
            }
        }

        this.stats.invalidations += count;
        console.log(`[Cache] INVALIDATED: ${count} entries matching ${pattern}`);
        return count;
    }

    /**
     * Limpa todo o cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`[Cache] CLEARED: ${size} entries`);
        return size;
    }

    /**
     * Obtém estatísticas do cache
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;

        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * Determina TTL apropriado baseado no tipo de dados
     * @param {string} toolName - Nome da ferramenta
     * @returns {number} TTL em milissegundos
     */
    getRecommendedTTL(toolName) {
        const lowerName = toolName.toLowerCase();

        // Dados muito dinâmicos (1 minuto)
        if (lowerName.includes('active') || lowerName.includes('realtime') || lowerName.includes('current')) {
            return 60000; // 1 min
        }

        // Dados dinâmicos (5 minutos)
        if (lowerName.includes('list') || lowerName.includes('search') || lowerName.includes('dashboard')) {
            return 300000; // 5 min
        }

        // Dados semi-estáticos (15 minutos)
        if (lowerName.includes('get') || lowerName.includes('detail')) {
            return 900000; // 15 min
        }

        // Dados estáticos (1 hora)
        if (lowerName.includes('config') || lowerName.includes('settings') || lowerName.includes('schema')) {
            return 3600000; // 1 hora
        }

        // Padrão: 10 minutos
        return 600000;
    }
}

// Singleton instance
export const cacheService = new CacheService();
