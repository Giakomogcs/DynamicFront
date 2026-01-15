import estimators from './estimators.js';
import CacheManager from './cacheManager.js';

class ParameterInferenceEngine {
    constructor() {
        this.estimators = new Map(Object.entries(estimators));
        this.cache = new CacheManager({ maxSize: 1000, ttl: 3600000 });
    }

    async infer(tool, objective) {
        console.log(`🧠 Inferring parameters for: ${tool.name}`);

        // Check cache first
        const cached = this.cache.get(tool.id, objective);
        if (cached) {
            console.log(`⚡ Cache hit for ${tool.id}`);
            return cached;
        }

        const inferred = {};
        const required = tool.inputSchema.required || [];

        for (const paramName of required) {
            const schema = tool.inputSchema.properties[paramName];

            // 1. Custom strategy
            if (tool.parameterInference?.strategies) {
                const strategy = tool.parameterInference.strategies.find(
                    s => s.paramName === paramName
                );

                if (strategy?.estimator) {
                    try {
                        const value = strategy.estimator({ objective, paramName });
                        inferred[paramName] = {
                            value,
                            confidence: 0.85,
                            method: 'custom_estimator'
                        };
                        continue;
                    } catch (e) {
                        console.warn(`Failed custom estimator: ${e.message}`);
                    }
                }
            }

            // 2. Default estimator
            const type = this._detectType(schema);
            const estimator = this.estimators.get(type);

            if (estimator) {
                try {
                    const result = estimator({ objective, paramName, schema });
                    // Handle both simple value return and detailed return from estimators
                    const value = result.value !== undefined ? result.value : result;
                    const confidence = result.confidence !== undefined ? result.confidence : 0.6;

                    inferred[paramName] = {
                        value: value,
                        confidence: confidence,
                        method: `default_${type}`
                    };
                } catch (e) {
                    console.warn(`Failed default estimator: ${e.message}`);
                }
            }
        }

        const values = Object.values(inferred);
        const avgConfidence = values.length > 0
            ? values.reduce((sum, v) => sum + v.confidence, 0) / values.length
            : 0;

        const result = {
            toolId: tool.id,
            parameters: inferred,
            confidence: avgConfidence,
            needsConfirmation: avgConfidence < 0.7 || Object.keys(inferred).length < required.length,
            strategy: this._selectStrategy(avgConfidence)
        };

        // Cache result
        this.cache.set(tool.id, objective, result);

        return result;
    }

    _detectType(schema) {
        if (schema.format === 'date') return 'date';
        if (schema.type === 'object' && schema.properties?.start) return 'daterange';
        if (schema.enum) return 'enum';
        if (schema.type === 'number' || schema.type === 'integer') return 'number';
        if (schema.type === 'boolean') return 'boolean';
        return 'string';
    }

    _selectStrategy(confidence) {
        if (confidence > 0.8) return 'full_auto';
        if (confidence > 0.5) return 'hybrid';
        return 'manual';
    }

    /**
     * Manual cache management
     */
    resetCache(toolId = null) {
        if (toolId) {
            this.cache.resetTool(toolId);
        } else {
            this.cache.reset();
        }
    }

    getCacheStats() {
        return this.cache.getStats();
    }
}

export default ParameterInferenceEngine;
