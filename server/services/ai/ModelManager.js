import prisma from '../../registry.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { GroqProvider } from './providers/GroqProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { XAIProvider } from './providers/XAIProvider.js';

class ModelManager {
    constructor() {
        this.providers = new Map();
        this.isInitialized = false;
        this.requestQueue = new RequestQueue(60);

        // Provider Health Tracking
        this.providerHealth = new Map(); // providerId -> { available: bool, lastError: Date, failCount: number }

        // Usage Metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            failoverCount: 0,
            providerUsage: new Map() // providerId -> count
        };
    }

    async init() {
        if (this.isInitialized) return;

        const settings = await this.loadSettings();

        // DYNAMIC PROVIDER REGISTRATION
        const providerConfigs = [
            { Provider: GeminiProvider, key: 'GEMINI_API_KEY', name: 'Gemini' },
            { Provider: GroqProvider, key: 'GROQ_API_KEY', name: 'Groq' },
            { Provider: OpenAIProvider, key: 'OPENAI_API_KEY', name: 'OpenAI' },
            { Provider: AnthropicProvider, key: 'ANTHROPIC_API_KEY', name: 'Anthropic' },
            { Provider: XAIProvider, key: 'XAI_API_KEY', name: 'xAI' }
        ];

        let availableCount = 0;

        for (const { Provider, key, name } of providerConfigs) {
            const apiKey = settings[key] || process.env[key];

            if (apiKey && apiKey.length > 10) { // Basic validation
                this.registerProvider(new Provider({ apiKey }));
                console.log(`[ModelManager] ✅ ${name} provider registered`);
                availableCount++;
            } else {
                console.warn(`[ModelManager] ⚠️ ${name} provider skipped (no API key)`);
            }
        }

        if (availableCount === 0) {
            throw new Error('[ModelManager] CRITICAL: No AI providers available! Please configure at least one API key.');
        }

        this.isInitialized = true;
        console.log(`[ModelManager] Initialized with ${availableCount}/${providerConfigs.length} providers.`);
    }

    async reload() {
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(async () => {
            console.log("[ModelManager] Reloading settings and providers...");
            this.providers = new Map();
            this.isInitialized = false;
            await this.init();
        }, 500); // 500ms debounce
    }

    async loadSettings() {
        try {
            const all = await prisma.systemSetting.findMany();
            const config = {};
            all.forEach(s => {
                let val = s.value;
                try { val = JSON.parse(s.value); } catch { }
                config[s.key] = val;
            });
            return config;
        } catch (e) {
            console.warn("[ModelManager] Failed to load settings from DB:", e.message);
            return {};
        }
    }

    registerProvider(provider) {
        this.providers.set(provider.id, provider);
    }

    async getAvailableModels() {
        await this.init();
        let allModels = [];
        for (const provider of this.providers.values()) {
            const models = await provider.listModels();
            allModels = [...allModels, ...models];
        }
        return allModels;
    }

    getProviderForModel(modelName) {
        if (!modelName) {
            // Return first available healthy provider
            for (const provider of this.providers.values()) {
                if (this.isProviderHealthy(provider.id)) return provider;
            }
            return this.providers.values().next().value;
        }

        // Provider detection map
        const detectionMap = [
            { pattern: /^gemini/i, providerId: 'gemini' },
            { pattern: /llama|mixtral|gemma/i, providerId: 'groq' },
            { pattern: /^gpt|^o1/i, providerId: 'openai' },
            { pattern: /^claude/i, providerId: 'anthropic' },
            { pattern: /grok/i, providerId: 'xai' }
        ];

        for (const { pattern, providerId } of detectionMap) {
            if (pattern.test(modelName)) {
                const provider = this.providers.get(providerId);
                if (provider) return provider;

                console.warn(`[ModelManager] Model ${modelName} matched ${providerId} but provider not available`);
            }
        }

        // Fallback: Return first available provider
        const fallback = this.providers.values().next().value;
        console.warn(`[ModelManager] Could not detect provider for ${modelName}, using fallback: ${fallback?.id}`);
        return fallback;
    }

    async generateContentWithFailover(input, config = {}) {
        return this.generateContent(input, config);
    }

    // Legacy alias to support old Executor calling convention roughly
    async executeQueuedRequest(fn) {
        return this.requestQueue.add(fn);
    }

    async generateContent(input, config = {}) {
        await this.init();
        this.recordMetric('request');

        let targetModel = config.model || "gemini-2.0-flash";
        let provider = this.getProviderForModel(targetModel);

        console.log(`[ModelManager] Generating content with ${targetModel} (Provider: ${provider?.id})...`);

        try {
            const result = await this.executeWithRetry(provider, targetModel, input, config);

            // SUCCESS: Mark provider as healthy
            this.markProviderHealthy(provider.id);
            this.recordMetric('success', provider.id);

            return result;
        } catch (primaryError) {
            console.warn(`[ModelManager] Primary execution failed for ${targetModel}. Error: ${primaryError.message}`);

            // Mark provider as unhealthy
            this.markProviderUnhealthy(provider.id, primaryError);

            // Check if 429 using robust check
            if (this.isRateLimitOrQuota(primaryError)) {
                console.warn(`[ModelManager] ⚠️ ${targetModel} hit Rate Limit/Quota. Initiating Failover...`);

                const failoverPlan = this.getFailoverPlan(targetModel);
                if (failoverPlan.length === 0) {
                    console.warn("[ModelManager] No failover plan found.");
                    this.recordMetric('failure');
                    throw primaryError;
                }

                for (const fallback of failoverPlan) {
                    console.log(`[ModelManager] 🔄 Failing over to: ${fallback.model} (${fallback.providerId})`);
                    this.recordMetric('failover');

                    try {
                        const fallbackProvider = this.providers.get(fallback.providerId);
                        if (!fallbackProvider) continue;

                        const result = await this.executeWithRetry(fallbackProvider, fallback.model, input, { ...config, model: fallback.model });

                        // SUCCESS: Mark fallback provider as healthy
                        this.markProviderHealthy(fallbackProvider.id);
                        this.recordMetric('success', fallbackProvider.id);

                        return result;
                    } catch (fbError) {
                        console.warn(`[ModelManager] Fallback (${fallback.model}) failed:`, fbError.message);
                        this.markProviderUnhealthy(fallback.providerId, fbError);
                        continue;
                    }
                }
            } else {
                console.warn("[ModelManager] Error was not identified as Rate Limit/Quota. Rethrowing.");
            }

            this.recordMetric('failure');
            throw primaryError;
        }
    }

    getFailoverPlan(failedModel, errorType = 'rate_limit') {
        const plan = [];

        // STRATEGY: Diversify across providers to avoid hitting same quota
        // Priority: Free/High Quota → Paid/Lower Quota → Premium

        // 1. GEMINI FAILOVER
        if (failedModel.includes('gemini')) {
            // Try other Gemini models first
            if (failedModel !== 'gemini-1.5-flash') {
                plan.push({ providerId: 'gemini', model: 'gemini-1.5-flash', tier: 'free' });
            }
            if (failedModel !== 'gemini-2.0-flash-lite') {
                plan.push({ providerId: 'gemini', model: 'gemini-2.0-flash-lite', tier: 'free' });
            }

            // Switch to Groq (Fast, Free Tier)
            plan.push({ providerId: 'groq', model: 'llama-3.3-70b-versatile', tier: 'free' });
            plan.push({ providerId: 'groq', model: 'llama-3.1-8b-instant', tier: 'free' });

            // Switch to OpenAI (Paid, but reliable)
            plan.push({ providerId: 'openai', model: 'gpt-3.5-turbo', tier: 'paid' });

            // Switch to Anthropic (Premium, high quota)
            plan.push({ providerId: 'anthropic', model: 'claude-3-haiku-20240307', tier: 'paid' });

            // Last resort: xAI Grok
            plan.push({ providerId: 'xai', model: 'grok-beta', tier: 'paid' });
        }

        // 2. GROQ FAILOVER
        else if (['llama', 'mixtral'].some(k => failedModel.includes(k))) {
            // Try smaller Groq model
            if (failedModel !== 'llama-3.1-8b-instant') {
                plan.push({ providerId: 'groq', model: 'llama-3.1-8b-instant', tier: 'free' });
            }

            // Switch to Gemini
            plan.push({ providerId: 'gemini', model: 'gemini-1.5-flash', tier: 'free' });
            plan.push({ providerId: 'gemini', model: 'gemini-2.0-flash-lite', tier: 'free' });

            // OpenAI
            plan.push({ providerId: 'openai', model: 'gpt-3.5-turbo', tier: 'paid' });

            // Anthropic
            plan.push({ providerId: 'anthropic', model: 'claude-3-haiku-20240307', tier: 'paid' });

            // xAI
            plan.push({ providerId: 'xai', model: 'grok-beta', tier: 'paid' });
        }

        // 3. OPENAI FAILOVER
        else if (['gpt', 'o1'].some(k => failedModel.includes(k))) {
            // Try cheaper OpenAI model
            if (failedModel !== 'gpt-3.5-turbo') {
                plan.push({ providerId: 'openai', model: 'gpt-3.5-turbo', tier: 'paid' });
            }

            // Switch to free tiers
            plan.push({ providerId: 'gemini', model: 'gemini-1.5-flash', tier: 'free' });
            plan.push({ providerId: 'groq', model: 'llama-3.3-70b-versatile', tier: 'free' });

            // Anthropic (similar quality)
            plan.push({ providerId: 'anthropic', model: 'claude-3-haiku-20240307', tier: 'paid' });

            // xAI
            plan.push({ providerId: 'xai', model: 'grok-beta', tier: 'paid' });
        }

        // 4. ANTHROPIC FAILOVER
        else if (failedModel.includes('claude')) {
            // Try cheaper Claude model
            if (failedModel !== 'claude-3-haiku-20240307') {
                plan.push({ providerId: 'anthropic', model: 'claude-3-haiku-20240307', tier: 'paid' });
            }

            // Switch to OpenAI (similar quality)
            plan.push({ providerId: 'openai', model: 'gpt-3.5-turbo', tier: 'paid' });

            // Free tiers
            plan.push({ providerId: 'gemini', model: 'gemini-1.5-flash', tier: 'free' });
            plan.push({ providerId: 'groq', model: 'llama-3.3-70b-versatile', tier: 'free' });

            // xAI
            plan.push({ providerId: 'xai', model: 'grok-beta', tier: 'paid' });
        }

        // 5. XAI FAILOVER
        else if (failedModel.includes('grok')) {
            // Switch to other providers
            plan.push({ providerId: 'openai', model: 'gpt-3.5-turbo', tier: 'paid' });
            plan.push({ providerId: 'anthropic', model: 'claude-3-haiku-20240307', tier: 'paid' });
            plan.push({ providerId: 'gemini', model: 'gemini-1.5-flash', tier: 'free' });
            plan.push({ providerId: 'groq', model: 'llama-3.3-70b-versatile', tier: 'free' });
        }

        // UNIVERSAL FALLBACK: If no specific plan, try all providers
        if (plan.length === 0) {
            plan.push(
                { providerId: 'gemini', model: 'gemini-1.5-flash', tier: 'free' },
                { providerId: 'groq', model: 'llama-3.3-70b-versatile', tier: 'free' },
                { providerId: 'openai', model: 'gpt-3.5-turbo', tier: 'paid' },
                { providerId: 'anthropic', model: 'claude-3-haiku-20240307', tier: 'paid' },
                { providerId: 'xai', model: 'grok-beta', tier: 'paid' }
            );
        }

        // FILTER: Remove unhealthy providers from plan
        return plan.filter(entry => {
            const healthy = this.isProviderHealthy(entry.providerId);
            if (!healthy) {
                console.log(`[ModelManager] ⚠️ Skipping ${entry.providerId}/${entry.model} - Provider marked unhealthy`);
            }
            return healthy;
        });
    }

    isRateLimitOrQuota(error) {
        try {
            const msg = (error.message || JSON.stringify(error) || "").toLowerCase();
            const status = error.status || error.statusCode || 0;

            // Check for 429 in various forms including Google's specific errors
            // ALSO check for Network/Connection errors (fetch failed) to trigger failover
            return status === 429 ||
                msg.includes("429") ||
                msg.includes("quota") ||
                msg.includes("too many requests") ||
                msg.includes("rate limit") ||
                msg.includes("resource_exhausted") ||
                msg.includes("insufficient_quota") || // OpenAI usage limit
                msg.includes("fetch failed") ||        // Node/Undici network error
                msg.includes("econnrefused") ||        // Connection refused
                msg.includes("etimedout") ||           // Timeout
                msg.includes("network error");         // Generic
        } catch (e) {
            return false;
        }
    }

    // Provider Health Monitoring Methods
    markProviderUnhealthy(providerId, error) {
        const health = this.providerHealth.get(providerId) || { available: true, failCount: 0 };
        health.available = false;
        health.lastError = new Date();
        health.failCount++;
        health.errorMessage = error.message;

        this.providerHealth.set(providerId, health);

        console.log(`[ModelManager] ❌ Provider ${providerId} marked unhealthy (fail count: ${health.failCount})`);

        // Auto-recover after 5 minutes
        setTimeout(() => {
            console.log(`[ModelManager] 🔄 Attempting to recover provider: ${providerId}`);
            this.markProviderHealthy(providerId);
        }, 5 * 60 * 1000);
    }

    markProviderHealthy(providerId) {
        const health = this.providerHealth.get(providerId) || {};
        health.available = true;
        health.lastError = null;
        health.failCount = 0; // Reset fail count on success
        this.providerHealth.set(providerId, health);
    }

    isProviderHealthy(providerId) {
        const health = this.providerHealth.get(providerId);
        if (!health) return true; // Assume healthy if no data

        // If provider failed more than 3 times in a row, mark as unhealthy
        if (health.failCount > 3) return false;

        return health.available;
    }

    // Metrics Tracking Methods
    recordMetric(type, providerId = null) {
        if (type === 'request') {
            this.metrics.totalRequests++;
        } else if (type === 'success') {
            this.metrics.successfulRequests++;
        } else if (type === 'failure') {
            this.metrics.failedRequests++;
        } else if (type === 'failover') {
            this.metrics.failoverCount++;
        }

        if (providerId) {
            const count = this.metrics.providerUsage.get(providerId) || 0;
            this.metrics.providerUsage.set(providerId, count + 1);
        }
    }

    getMetrics() {
        const total = this.metrics.totalRequests || 1; // Avoid division by zero
        return {
            ...this.metrics,
            successRate: (this.metrics.successfulRequests / total * 100).toFixed(2) + '%',
            failoverRate: (this.metrics.failoverCount / total * 100).toFixed(2) + '%',
            providerUsage: Object.fromEntries(this.metrics.providerUsage)
        };
    }

    async executeWithRetry(provider, model, input, config) {
        const result = await this.requestQueue.add(() => provider.generateContent(input, { ...config, model }));
        // Map result to pseudo-Gemini response format if needed for legacy code?
        // Legacy code expects: result.response.text(), result.response.functionCalls()

        // Let's return a "UniversalResponse" object that has getters to match Gemini behavior for backward compat
        return {
            usedModel: model,
            response: {
                text: () => result.text,
                functionCalls: () => result.toolCalls || []
            }
        };
    }
}

class RequestQueue {
    constructor(rpm = 60) {
        this.delay = 60000 / rpm;
        this.queue = [];
        this.processing = false;
        this.lastTime = 0;
    }

    add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing) return;
        this.processing = true;
        while (this.queue.length) {
            const now = Date.now();
            const info = this.queue[0]; // Peek
            const wait = Math.max(0, this.delay - (now - this.lastTime));

            if (wait > 0) await new Promise(r => setTimeout(r, wait));

            this.queue.shift(); // Remove
            this.lastTime = Date.now();

            try {
                const res = await info.fn();
                info.resolve(res);
            } catch (e) {
                // If 429, maybe we should retry internally in queue? 
                // ModelManager handles high level failover. 
                // We should let error propagate so ModelManager can switch model.
                info.reject(e);
            }
        }
        this.processing = false;
    }
}

export const modelManager = new ModelManager();
