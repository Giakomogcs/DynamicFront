/**
 * DataSourceManager - Phase 5.1
 * 
 * Manages data sources for components:
 * - Defines how components fetch data
 * - Handles refresh intervals
 * - Manages cache and invalidation
 * - Supports reactive updates
 */
export class DataSourceManager {
    constructor() {
        this.dataSources = new Map(); // componentId → dataSource
        this.cache = new Map(); // cacheKey → {data, timestamp, ttl}
        this.refreshIntervals = new Map(); // componentId → intervalId
    }

    /**
     * Registers a data source for a component
     * @param {string} componentId - Component ID
     * @param {Object} dataSource - Data source specification
     */
    registerDataSource(componentId, dataSource) {
        console.log(`[DataSourceManager] Registering data source for ${componentId}`);

        const normalized = this.normalizeDataSource(dataSource);
        this.dataSources.set(componentId, normalized);

        // Setup auto-refresh if configured
        if (normalized.refreshInterval) {
            this.setupAutoRefresh(componentId, normalized.refreshInterval);
        }

        return normalized;
    }

    /**
     * Normalizes data source specification
     * @private
     */
    normalizeDataSource(dataSource) {
        return {
            type: dataSource.type || 'api', // api, websocket, graphql, cache
            tool: dataSource.tool,
            params: dataSource.params || {},
            transform: dataSource.transform || (data => data),
            cache: {
                enabled: dataSource.cache?.enabled !== false,
                ttl: dataSource.cache?.ttl || 300000, // 5 minutes default
                key: dataSource.cache?.key || null
            },
            refreshInterval: dataSource.refreshInterval || null,
            invalidateOn: dataSource.invalidateOn || [],
            dependencies: dataSource.dependencies || [] // Other components this depends on
        };
    }

    /**
     * Fetches data for a component
     * @param {string} componentId - Component ID
     * @param {Object} executeFunction - Function to execute tool
     * @returns {Promise<Object>} - Data result
     */
    async fetchData(componentId, executeFunction) {
        const dataSource = this.dataSources.get(componentId);

        if (!dataSource) {
            throw new Error(`No data source registered for ${componentId}`);
        }

        // Check cache first
        if (dataSource.cache.enabled) {
            const cacheKey = this.getCacheKey(dataSource);
            const cached = this.getFromCache(cacheKey);

            if (cached) {
                console.log(`[DataSourceManager] Cache hit for ${componentId}`);
                return { data: cached, fromCache: true };
            }
        }

        // Execute data source
        console.log(`[DataSourceManager] Fetching fresh data for ${componentId}`);
        let rawData;

        switch (dataSource.type) {
            case 'api':
                rawData = await this.fetchFromApi(dataSource, executeFunction);
                break;

            case 'websocket':
                rawData = await this.fetchFromWebSocket(dataSource);
                break;

            case 'graphql':
                rawData = await this.fetchFromGraphQL(dataSource);
                break;

            default:
                throw new Error(`Unsupported data source type: ${dataSource.type}`);
        }

        // Transform data
        const transformed = dataSource.transform(rawData);

        // Cache if enabled
        if (dataSource.cache.enabled) {
            const cacheKey = this.getCacheKey(dataSource);
            this.setCache(cacheKey, transformed, dataSource.cache.ttl);
        }

        return { data: transformed, fromCache: false };
    }

    /**
     * Fetches data from API (tool execution)
     * @private
     */
    async fetchFromApi(dataSource, executeFunction) {
        if (!executeFunction) {
            throw new Error('Execute function required for API data source');
        }

        // Resolve dynamic params (e.g., {{filter.state}})
        const resolvedParams = this.resolveParams(dataSource.params);

        const result = await executeFunction(dataSource.tool, resolvedParams);

        if (result.error) {
            throw new Error(`Tool execution failed: ${result.error}`);
        }

        return result.gatheredData || result.data || [];
    }

    /**
     * Fetches data from WebSocket
     * @private
     */
    async fetchFromWebSocket(dataSource) {
        // WebSocket implementation would go here
        // For now, return placeholder
        console.warn('[DataSourceManager] WebSocket not yet implemented');
        return [];
    }

    /**
     * Fetches data from GraphQL
     * @private
     */
    async fetchFromGraphQL(dataSource) {
        // GraphQL implementation would go here
        console.warn('[DataSourceManager] GraphQL not yet implemented');
        return [];
    }

    /**
     * Resolves dynamic parameters
     * @private
     */
    resolveParams(params) {
        const resolved = {};

        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
                // Dynamic reference - would be resolved from context
                // For now, just remove the template syntax
                resolved[key] = value.replace(/{{|}}/g, '').trim();
            } else {
                resolved[key] = value;
            }
        }

        return resolved;
    }

    /**
     * Generates cache key
     * @private
     */
    getCacheKey(dataSource) {
        if (dataSource.cache.key) {
            return dataSource.cache.key;
        }

        // Generate from tool + params
        return `${dataSource.tool}:${JSON.stringify(dataSource.params)}`;
    }

    /**
     * Gets data from cache
     * @private
     */
    getFromCache(key) {
        const cached = this.cache.get(key);

        if (!cached) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Sets data in cache
     * @private
     */
    setCache(key, data, ttl) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });

        console.log(`[DataSourceManager] Cached data with key: ${key}`);
    }

    /**
     * Invalidates cache
     * @param {string|Array} keys - Cache keys to invalidate
     */
    invalidateCache(keys) {
        const keysArray = Array.isArray(keys) ? keys : [keys];

        keysArray.forEach(key => {
            if (key === '*') {
                // Invalidate all
                this.cache.clear();
                console.log('[DataSourceManager] Cleared entire cache');
            } else {
                this.cache.delete(key);
                console.log(`[DataSourceManager] Invalidated cache: ${key}`);
            }
        });
    }

    /**
     * Invalidates cache based on event
     * @param {string} event - Event name
     */
    invalidateByEvent(event) {
        console.log(`[DataSourceManager] Invalidating cache for event: ${event}`);

        // Find all data sources that should invalidate on this event
        const toInvalidate = [];

        this.dataSources.forEach((dataSource, componentId) => {
            if (dataSource.invalidateOn.includes(event)) {
                const cacheKey = this.getCacheKey(dataSource);
                toInvalidate.push(cacheKey);
            }
        });

        this.invalidateCache(toInvalidate);
    }

    /**
     * Sets up auto-refresh for a component
     * @private
     */
    setupAutoRefresh(componentId, interval) {
        // Clear existing interval if any
        this.clearAutoRefresh(componentId);

        console.log(`[DataSourceManager] Setting up auto-refresh for ${componentId} every ${interval}ms`);

        const intervalId = setInterval(() => {
            console.log(`[DataSourceManager] Auto-refreshing ${componentId}`);
            this.triggerRefresh(componentId);
        }, interval);

        this.refreshIntervals.set(componentId, intervalId);
    }

    /**
     * Clears auto-refresh for a component
     * @param {string} componentId - Component ID
     */
    clearAutoRefresh(componentId) {
        const intervalId = this.refreshIntervals.get(componentId);

        if (intervalId) {
            clearInterval(intervalId);
            this.refreshIntervals.delete(componentId);
            console.log(`[DataSourceManager] Cleared auto-refresh for ${componentId}`);
        }
    }

    /**
     * Triggers a refresh (would emit event to client)
     * @param {string} componentId - Component to refresh
     */
    triggerRefresh(componentId) {
        // In real implementation, this would emit WebSocket event
        // For now, just log
        console.log(`[DataSourceManager] Refresh triggered for ${componentId}`);
    }

    /**
     * Unregisters a data source
     * @param {string} componentId - Component ID
     */
    unregister(componentId) {
        this.clearAutoRefresh(componentId);
        this.dataSources.delete(componentId);
        console.log(`[DataSourceManager] Unregistered data source for ${componentId}`);
    }

    /**
     * Gets statistics
     * @returns {Object} - Stats
     */
    getStats() {
        return {
            registeredSources: this.dataSources.size,
            cachedItems: this.cache.size,
            activeRefreshes: this.refreshIntervals.size
        };
    }
}

export const dataSourceManager = new DataSourceManager();
