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
    }

    async init() {
        if (this.isInitialized) return;

        const settings = await this.loadSettings();

        // Safe loading of keys
        this.registerProvider(new GeminiProvider({
            apiKey: settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY
        }));

        this.registerProvider(new GroqProvider({
            apiKey: settings.GROQ_API_KEY || process.env.GROQ_API_KEY
        }));

        this.registerProvider(new OpenAIProvider({
            apiKey: settings.OPENAI_API_KEY || process.env.OPENAI_API_KEY
        }));

        this.registerProvider(new AnthropicProvider({
            apiKey: settings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
        }));

        this.registerProvider(new XAIProvider({
            apiKey: settings.XAI_API_KEY || process.env.XAI_API_KEY
        }));

        this.isInitialized = true;
        console.log("[ModelManager] Initialized.");
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
        if (!modelName) return this.providers.get('gemini');
        if (modelName.startsWith('gemini')) return this.providers.get('gemini');
        if (modelName.includes('llama') || modelName.includes('mixtral') || modelName.includes('gemma')) return this.providers.get('groq');
        if (modelName.startsWith('gpt') || modelName.startsWith('o1')) return this.providers.get('openai');
        if (modelName.startsWith('claude')) return this.providers.get('anthropic');
        if (modelName.includes('grok')) return this.providers.get('xai');
        return this.providers.get('gemini');
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

        let targetModel = config.model || "gemini-2.0-flash";
        let provider = this.getProviderForModel(targetModel);

        console.log(`[ModelManager] Generating content with ${targetModel} (Provider: ${provider?.id})...`);

        try {
            return await this.executeWithRetry(provider, targetModel, input, config);
        } catch (primaryError) {
            console.warn(`[ModelManager] Primary execution failed for ${targetModel}. Error: ${primaryError.message}`);
            
            // Check if 429 using robust check
            if (this.isRateLimitOrQuota(primaryError)) {
                console.warn(`[ModelManager] ⚠️ ${targetModel} hit Rate Limit/Quota. Initiating Failover...`);

                const failoverPlan = this.getFailoverPlan(targetModel);
                if (failoverPlan.length === 0) console.warn("[ModelManager] No failover plan found.");

                for (const fallback of failoverPlan) {
                    console.log(`[ModelManager] 🔄 Failing over to: ${fallback.model} (${fallback.providerId})`);
                    try {
                        const fallbackProvider = this.providers.get(fallback.providerId);
                        if (!fallbackProvider) continue;

                        return await this.executeWithRetry(fallbackProvider, fallback.model, input, { ...config, model: fallback.model });
                    } catch (fbError) {
                        console.warn(`[ModelManager] Fallback (${fallback.model}) failed:`, fbError.message);
                        continue;
                    }
                }
            } else {
                 console.warn("[ModelManager] Error was not identified as Rate Limit/Quota. Rethrowing.");
            }
            throw primaryError;
        }
    }

    getFailoverPlan(failedModel) {
        const plan = [];
        // Gemini Failover
        if (failedModel.includes('gemini')) {
            if (failedModel !== 'gemini-2.0-flash') plan.push({ providerId: 'gemini', model: 'gemini-2.0-flash' });
            plan.push({ providerId: 'gemini', model: 'gemini-2.0-flash-lite' });
            plan.push({ providerId: 'groq', model: 'llama-3.3-70b-versatile' });
        }
        // Llama/Groq Failover
        else if (['llama', 'mixtral'].some(k => failedModel.includes(k))) {
            plan.push({ providerId: 'groq', model: 'llama-3.1-8b-instant' });
            plan.push({ providerId: 'gemini', model: 'gemini-2.0-flash' });
        }
        // OpenAI Failover (NEW)
        else if (['gpt', 'o1'].some(k => failedModel.includes(k))) {
            // Fallback to Gemini 2.0 Flash (Fast and Capable)
            plan.push({ providerId: 'gemini', model: 'gemini-2.0-flash' });
            // Fallback to Groq Llama 3.3
            plan.push({ providerId: 'groq', model: 'llama-3.3-70b-versatile' });
        }
        return plan;
    }

    isRateLimitOrQuota(error) {
        try {
            const msg = (error.message || JSON.stringify(error) || "").toLowerCase();
            const status = error.status || error.statusCode || 0;
            
            // Check for 429 in various forms including Google's specific errors
            return status === 429 ||
                msg.includes("429") ||
                msg.includes("quota") ||
                msg.includes("too many requests") ||
                msg.includes("rate limit") ||
                msg.includes("resource_exhausted") ||
                msg.includes("insufficient_quota"); // OpenAI usage limit
        } catch (e) {
            return false;
        }
    }

    async executeWithRetry(provider, model, input, config) {
        const result = await this.requestQueue.add(() => provider.generateContent(input, { ...config, model }));
        // Map result to pseudo-Gemini response format if needed for legacy code?
        // Legacy code expects: result.response.text(), result.response.functionCalls()

        // Let's return a "UniversalResponse" object that has getters to match Gemini behavior for backward compat
        return {
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
