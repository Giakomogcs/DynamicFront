import prisma from '../../registry.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { GroqProvider } from './providers/GroqProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { XAIProvider } from './providers/XAIProvider.js';
import { CopilotProvider } from './providers/CopilotProvider.js';
import { GenericOpenAIProvider } from './providers/GenericOpenAIProvider.js';
import { GeminiInternalProvider } from '../gemini/GeminiInternalProvider.js';
import { tokenTracker } from './TokenTrackingService.js';

class ModelManager {
    constructor() {
        this.providers = new Map();
        this.isInitialized = false;
        this.requestQueue = new RequestQueue(60);

        // Provider Health Tracking
        this.providerHealth = new Map(); // providerId -> { available: bool, lastError: Date, failCount: number }

        // Models Cache with TTL
        this.modelsCache = null;
        this.modelsCacheTimestamp = 0;
        this.modelsCacheTTL = 60000; // 60 seconds

        // Usage Metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            failoverCount: 0,
            providerUsage: new Map() // providerId -> count
        };

        // Logging Throttle (Prevent Spam)
        this.lastLogTime = new Map(); // key -> timestamp
        this.lastReloadTime = 0;
    }

    async init() {
        if (this.isInitialized) return;

        const settings = await this.loadSettings();

        this.settings = settings; // Store for runtime access (e.g. failover check)

        this.providerConfigs = [
            { Provider: GeminiProvider, key: 'GEMINI_API_KEY', name: 'Gemini', id: 'gemini' },
            { Provider: GroqProvider, key: 'GROQ_API_KEY', name: 'Groq', id: 'groq' },
            { Provider: OpenAIProvider, key: 'OPENAI_API_KEY', name: 'OpenAI', id: 'openai' },
            { Provider: AnthropicProvider, key: 'ANTHROPIC_API_KEY', name: 'Anthropic', id: 'anthropic' },
            { Provider: XAIProvider, key: 'XAI_API_KEY', name: 'xAI', id: 'xai' },
            { Provider: CopilotProvider, key: 'GITHUB_COPILOT_TOKEN', name: 'Copilot', id: 'copilot' }
        ];

        // DYNAMIC PROVIDER REGISTRATION
        const providerConfigs = this.providerConfigs;

        let availableCount = 0;

        // Helper to check if provider is globally enabled (default true)
        const isProviderEnabled = (id) => {
            const settingKey = `PROVIDER_ENABLED_${id.toUpperCase()}`;
            return settings[settingKey] !== false; // Default true if undefined
        };

        const isGeminiInternalEnabled = isProviderEnabled('gemini-internal');

        // LOCAL LLM REGISTRATION
        if (settings.LM_STUDIO_URL && isProviderEnabled('lmstudio')) {
            this.registerProvider(new GenericOpenAIProvider({
                id: 'lmstudio',
                name: 'LM Studio',
                baseUrl: settings.LM_STUDIO_URL,
                apiKey: 'lm-studio'
            }));
            console.log(`[ModelManager] ✅ LM Studio provider registered at ${settings.LM_STUDIO_URL}`);
            availableCount++;
        }

        if (settings.OLLAMA_URL && isProviderEnabled('ollama')) {
            this.registerProvider(new GenericOpenAIProvider({
                id: 'ollama',
                name: 'Ollama',
                baseUrl: settings.OLLAMA_URL,
                apiKey: 'ollama'
            }));
            console.log(`[ModelManager] ✅ Ollama provider registered at ${settings.OLLAMA_URL}`);
            availableCount++;
        }

        for (const { Provider, key, name, id } of providerConfigs) {
            // Load API key from database settings ONLY (no .env fallback)
            let apiKey = settings[key];

            // Treat empty strings as undefined (disabled)
            if (apiKey !== undefined && apiKey !== null && apiKey.trim() === "") {
                apiKey = undefined;
            }

            const enabled = isProviderEnabled(id);

            if (apiKey && apiKey.length > 5 && enabled) { // Basic validation + Enabled Check
                const provider = new Provider({ apiKey });
                this.registerProvider(provider);

                // Do not block startup with network calls, but we could trigger a background check
                console.log(`[ModelManager] ➕ ${name} provider registered (Validation Pending)`);

                // Trigger background validation ONLY if not recently failed
                const health = this.providerHealth.get(id);
                const shouldSkipValidation = health && !health.available && health.lastError && (Date.now() - health.lastError.getTime() < 60000);

                if (!shouldSkipValidation) {
                    this.validateProvider(provider.id).catch(e => {
                        // Suppress repeated validation errors
                        this._logThrottled(`validation-error-${id}`, () => {
                            console.warn(`[ModelManager] Background validation failed for ${name}: ${e.message}`);
                        }, 60000); // Log once per minute
                    });
                }

                availableCount++;
            } else {
                // Throttle "provider skipped" warnings
                this._logThrottled(`provider-skip-${id}`, () => {
                    if (!enabled) console.log(`[ModelManager] 🚫 ${name} provider disabled by user setting.`);
                    else console.warn(`[ModelManager] ⚠️ ${name} provider skipped (no API key)`);
                }, 300000); // Log once every 5 minutes
            }
        }

        if (availableCount === 0 && !isGeminiInternalEnabled) {
            console.warn('[ModelManager] WARN: No AI providers available! Chat will fail.');
        }

        // LOAD DYNAMIC PROVIDERS (Gemini Internal)
        await this.loadDynamicProviders();

        this.isInitialized = true;
        console.log(`[ModelManager] Initialized. Total Providers Registered: ${this.providers.size}`);
    }

    async reload(force = false) {
        // If force is true, bypass throttle and execute immediately
        if (force) {
            if (this.reloadTimer) {
                clearTimeout(this.reloadTimer);
                if (this.reloadResolve) this.reloadResolve(); // Resolve pending
            }
            console.log("[ModelManager] 🔄 Forcing immediate reload...");
            this.providers = new Map();
            this.modelsCache = null; // FORCE CLEAR CACHE
            this.isInitialized = false;
            await this.init();
            this.lastReloadTime = Date.now();
            return;
        }

        // Standard debounce logic
        const now = Date.now();
        if (now - this.lastReloadTime < 3000 && !this.reloadTimer) {
            // Too soon, but if no timer, we are done.
            return;
        }

        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            if (this.reloadResolve) {
                this.reloadResolve(); // Resolve the previous caller immediately (superseded)
                this.reloadResolve = null;
            }
        }

        // Return a promise that resolves when the reloaded completes
        return new Promise((resolve) => {
            // Keep track of resolve to call it if superseded
            this.reloadResolve = resolve;

            this.reloadTimer = setTimeout(async () => {
                this.lastReloadTime = Date.now();
                this._logThrottled('reload', () => {
                    console.log("[ModelManager] Reloading settings and providers...");
                }, 5000);
                this.providers = new Map();
                this.modelsCache = null; // Clear cache on reload
                this.isInitialized = false;
                await this.init();

                if (this.reloadResolve) this.reloadResolve();
                this.reloadResolve = null;
                this.reloadTimer = null;
            }, 1000); // 1s debounce
        });
    }

    // NEW: Targeted refresh for a single provider (avoids full reload/crash)
    async refreshProvider(providerId) {
        if (!this.isInitialized) await this.init();

        console.log(`[ModelManager] 🔄 Refreshing provider: ${providerId}`);

        // 1. Reload settings from DB to get new keys
        const settings = await this.loadSettings();
        this.settings = settings;

        // 2. Find config for this provider
        const config = this.providerConfigs.find(p => p.id === providerId);

        if (!config) {
            // Handle Special Cases (Local, Internal)
            if (providerId === 'gemini-internal') {
                console.log(`[ModelManager] 🔄 Refreshing Gemini Internal...`);
                await this.loadDynamicProviders();
                this.modelsCache = null;
                return true;
            }
            // TODO: Add support for refreshing Local/Internal via this method if needed
            console.warn(`[ModelManager] Cannot refresh ${providerId} (not in standard configs)`);
            return false;
        }

        // 3. Re-instantiate
        const { Provider, key, name } = config;
        let apiKey = settings[key];

        if (apiKey && apiKey.trim() === "") apiKey = undefined;

        const isEnabled = settings[`PROVIDER_ENABLED_${providerId.toUpperCase()}`] !== false;

        if (apiKey && apiKey.length > 5 && isEnabled) {
            const provider = new Provider({ apiKey });
            this.registerProvider(provider);
            console.log(`[ModelManager] ➕ Refreshed ${name}`);

            // Clear specific health cache
            this.providerHealth.delete(providerId);

            // Clear global models cache to force re-fetch
            this.modelsCache = null;

            return true;
        } else {
            console.log(`[ModelManager] 🚫 ${name} disabled or missing key after refresh`);
            this.providers.delete(providerId);
            this.modelsCache = null;
            return false;
        }
    }

    async loadSettings() {
        try {
            const all = await prisma.systemSetting.findMany();
            const config = {};
            all.forEach(s => {
                let val = s.value;
                try { val = JSON.parse(s.value); } catch { }

                // EXTRA ROBUSTNESS: Handle stringified booleans if JSON.parse didn't catch them
                if (val === 'false') val = false;
                if (val === 'true') val = true;

                config[s.key] = val;

                if (s.key && s.key.startsWith('PROVIDER_ENABLED')) {
                    console.log(`[ModelManager] Loaded Setting: ${s.key} = ${val} (Type: ${typeof val})`);
                }
            });
            return config;
        } catch (e) {
            console.warn("[ModelManager] Failed to load settings from DB:", e.message);
            return {};
        }
    }

    async loadDynamicProviders() {
        try {
            // Check if Gemini Internal is enabled in settings
            const isGeminiInternalEnabled = this.settings?.['PROVIDER_ENABLED_GEMINI-INTERNAL'] !== false;

            if (!isGeminiInternalEnabled) {
                console.log('[ModelManager] 🚫 Gemini Internal provider disabled by user setting.');
                return;
            }

            // Find OAuth-based providers from ConnectedProvider table
            const providers = await prisma.connectedProvider.findMany({
                where: {
                    isEnabled: true,
                    providerId: 'gemini-internal'
                }
            });

            for (const conn of providers) {
                try {
                    const tokens = {
                        access_token: conn.accessToken,
                        refresh_token: conn.refreshToken,
                        expiry_date: conn.tokenExpiry ? conn.tokenExpiry.getTime() : null
                    };

                    const provider = new GeminiInternalProvider(tokens);
                    // Try initialize but don't block registration on failure
                    await provider.initialize().catch(e => {
                        console.warn(`[ModelManager] Handshake failed for ${conn.accountEmail} during load, but registering anyway:`, e.message);
                    });

                    this.registerProvider(provider);
                    console.log(`[ModelManager] ➕ Registered Gemini Internal (${conn.accountEmail})`);
                } catch (e) {
                    console.warn(`[ModelManager] Failed to load provider ${conn.providerName}:`, e);
                }
            }
        } catch (e) {
            console.error("[ModelManager] Dynamic load error:", e);
        }
    }


    registerProvider(provider) {
        this.providers.set(provider.id, provider);
    }

    async getAvailableModels(useCache = true, onlyEnabled = true) {
        await this.init();

        // Check cache first if enabled - separate cache for enabled/all?
        // To be safe, bypass cache if onlyEnabled is false (usually for settings view)
        const now = Date.now();
        if (useCache && onlyEnabled && this.modelsCache && (now - this.modelsCacheTimestamp) < this.modelsCacheTTL) {
            return this.modelsCache;
        }

        let allModels = [];

        // Strict Validation: Only return models from providers that are HEALTHY, VERIFIED, and ENABLED
        for (const provider of this.providers.values()) {
            // Check if provider is enabled in current settings
            const settingKey = `PROVIDER_ENABLED_${provider.id.toUpperCase()}`;
            if (this.settings?.[settingKey] === false) {
                continue;
            }

            // Check health cache
            if (!this.isProviderHealthy(provider.id)) {
                // Throttle "Skipping models" warnings
                this._logThrottled(`skip-models-${provider.id}`, () => {
                    console.warn(`[ModelManager] Skipping models for ${provider.id} (Unhealthy)`);
                }, 60000); // Log once per minute
                continue;
            }

            try {
                // Ensure we can list models (Validation Check)
                const models = await provider.listModels();
                if (models && models.length > 0) {
                    allModels = [...allModels, ...models];
                } else {
                    console.warn(`[ModelManager] Provider ${provider.id} returned no models. Marking as suspicious.`);
                    // Optional: Mark unhealthy?
                }
            } catch (e) {
                console.warn(`[ModelManager] Failed to list models for ${provider.id}: ${e.message}`);
                this.markProviderUnhealthy(provider.id, e);
            }
        }

        // Update cache

        // Filter by enabledModels if configured
        if (onlyEnabled && this.settings?.enabledModels && Array.isArray(this.settings.enabledModels) && this.settings.enabledModels.length > 0) {
            const enabledSet = new Set(this.settings.enabledModels);
            allModels = allModels.filter(m => {
                // Check direct name match
                if (enabledSet.has(m.name)) return true;
                if (m.id && enabledSet.has(m.id)) return true;
                
                // Legacy support for Gemini Internal: check if technical ID matches a pretty name in the set
                if (m.provider === 'gemini-internal' || m.id?.includes('gemini-2.5') || m.id?.includes('gemini-3')) {
                     // If we have "Gemini 2.5 Flash (CLI)" in set, but model name is "gemini-2.5-flash"
                     // We should effectively match them.
                     return Array.from(enabledSet).some(e => 
                         typeof e === 'string' && (
                             e.toLowerCase().replace(' ', '-').includes(m.name) ||
                             m.name.toLowerCase().replace(' ', '-').includes(e.replace(' (CLI)', '').toLowerCase().replace(' ', '-'))
                         )
                     );
                }
                return false;
            });
        }

        if (onlyEnabled) {
            this.modelsCache = allModels;
            this.modelsCacheTimestamp = now;
        }

        return allModels;
    }

    getSmartDefaultModel(providerId) {
        const defaults = {
            'gemini-internal': 'gemini-2.5-flash',
            'gemini': 'gemini-2.0-flash',
            'openai': 'gpt-4o',
            'anthropic': 'claude-3-5-sonnet-20240620',
            'groq': 'llama-3.3-70b-versatile',
            'xai': 'grok-beta',
            'copilot': 'gpt-4o'
        };
        return defaults[providerId] || 'gemini-2.0-flash';
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
            { pattern: /gemini-2\.5|gemini-3|.*\(CLI\)/i, providerId: 'gemini-internal' }, // Internal models or anything with (CLI)
            { pattern: /^gemini/i, providerId: 'gemini' },
            { pattern: /llama|mixtral|gemma/i, providerId: 'groq' },
            { pattern: /^gpt|^o1/i, providerId: 'openai' },
            { pattern: /^claude/i, providerId: 'anthropic' },
            { pattern: /grok/i, providerId: 'xai' },
            { pattern: /^copilot/i, providerId: 'copilot' },
            { pattern: /local|lm-studio/i, providerId: 'lmstudio' },
            { pattern: /ollama/i, providerId: 'ollama' }
        ];

        for (const { pattern, providerId } of detectionMap) {
            if (pattern.test(modelName)) {
                const provider = this.providers.get(providerId);
                if (provider) return provider;

                console.warn(`[ModelManager] Model ${modelName} matched ${providerId} but provider not available`);
            }
        }

        // Fallback: If model name matches a provider ID partially (e.g. "lmstudio/my-model")
        if (modelName.includes('lmstudio')) return this.providers.get('lmstudio');
        if (modelName.includes('ollama')) return this.providers.get('ollama');

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

    async generateContent(input, inputConfig = {}) {
        await this.init();
        this.recordMetric('request');

        // Copy config to avoid mutation
        const config = { ...inputConfig };

        let targetModel = config.model || "gemini-2.0-flash";
        let provider = this.getProviderForModel(targetModel);

        console.log(`[ModelManager] Generating content with ${targetModel} (Provider: ${provider?.id})...`);

        if (!provider) {
            console.error(`No provider available for model ${targetModel}`);
            // Try a forced fallback?
            provider = this.providers.values().next().value;
            if (!provider) throw new Error(`No providers available at all. Please configure keys in Settings.`);
            console.log(`[ModelManager] Forced fallback to ${provider.id}...`);
        }

        // AUTOMATIC MODEL SWITCH: If we switched provider (or used fallback), check if it supports the requested model.
        // If not (likely), switch to its default.
        if (provider) {
            const isSupported = await this.isModelSupportedByProvider(provider, targetModel);
            if (!isSupported) {
                const newModel = this.getSmartDefaultModel(provider.id);
                console.log(`[ModelManager] ⚠️ Switching model from ${targetModel} to ${newModel} because provider is ${provider.id}`);
                targetModel = newModel;
                config.model = newModel; // Update config for failover reference
            }
        }

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

    async isModelSupportedByProvider(provider, modelName) {
        // Quick check using regex patterns or provider prefix
        if (modelName.toLowerCase().includes(provider.id)) return true;
        
        // STRICT CHECK for Gemini Internal (CLI)
        // It only supports a specific set of models (2.5, 3.0-preview)
        // We must NOT allow it to take generic 'gemini-2.0-flash' or 'gemini-1.5' requests
        if (provider.id === 'gemini-internal') {
             // Retrieve the list of supported models from the provider instance
             const supportedModels = await provider.listModels();
             return supportedModels.some(m => m.id === modelName || m.name === modelName);
        }

        // Default heuristic for other providers
        if (provider.id === 'openai' && modelName.startsWith('gpt')) return true;
        if (provider.id === 'anthropic' && modelName.startsWith('claude')) return true;
        return false;
    }

    getFailoverPlan(failedModel, errorType = 'rate_limit') {
        // CHECK IF FAILOVER IS GLOBALLY ENABLED
        if (this.settings?.FAILOVER_ENABLED === false) {
            console.warn("[ModelManager] Failover is disabled in settings.");
            return [];
        }

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
                { providerId: 'xai', model: 'grok-beta', tier: 'paid' },
                { providerId: 'copilot', model: 'copilot/gpt-4', tier: 'paid' }
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

        // CRITICAL: Invalidate models cache to immediately remove this provider's models
        this.modelsCache = null;
        this.modelsCacheTimestamp = 0;

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

    async validateProvider(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) return false;

        try {
            // Force a listModels check to verify API key
            console.log(`[ModelManager] Validating ${providerId}...`);
            const models = await provider.listModels();

            if (models && models.length > 0) {
                this.markProviderHealthy(providerId);
                console.log(`[ModelManager] ✅ ${providerId} validated successfully (${models.length} models)`);

                // Invalidate models cache to force refresh
                this.modelsCache = null;

                return true;
            } else {
                throw new Error("No models returned");
            }
        } catch (e) {
            console.warn(`[ModelManager] ❌ Validation failed for ${providerId}: ${e.message}`);
            this.markProviderUnhealthy(providerId, e);

            // Invalidate models cache to force refresh
            this.modelsCache = null;

            return false;
        }
    }

    async forceRevalidate(providerId) {
        // Force validation by clearing health cache first
        console.log(`[ModelManager] Force revalidating ${providerId}...`);

        const provider = this.providers.get(providerId);
        if (!provider) {
            console.warn(`[ModelManager] Provider ${providerId} not found`);
            return false;
        }

        // Clear health cache to force fresh validation
        this.providerHealth.delete(providerId);

        // Clear models cache
        this.modelsCache = null;

        // Run validation
        return await this.validateProvider(providerId);
    }

    isProviderHealthy(providerId) {
        const health = this.providerHealth.get(providerId);
        if (!health) return true; // Assume healthy if no data (or pending)

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

    async getProviderStatuses() {
        const statuses = {};

        // 1. Get statuses for active providers
        for (const [id, provider] of this.providers.entries()) {
            const health = this.providerHealth.get(id) || { available: true };
            const isHealthy = this.isProviderHealthy(id);
            const quotaStatus = await tokenTracker.getQuotaStatus(id).catch(() => null);

            let models = [];
            try {
                if (isHealthy) {
                    models = await provider.listModels().catch(() => []);
                }
            } catch (e) { }

            statuses[id] = {
                id,
                name: provider.name,
                status: isHealthy ? 'online' : 'offline',
                available: isHealthy,
                healthy: isHealthy,
                valid: isHealthy,
                connected: true, // If it's in this.providers, it's connected
                lastError: health.lastError,
                errorMessage: health.errorMessage,
                failCount: health.failCount,
                models: models,
                quota: quotaStatus
            };
        }

        // 2. Add statuses for connected but disabled providers (Gemini CLI)
        if (!statuses['gemini-internal']) {
            const geminiConn = await prisma.connectedProvider.findFirst({
                where: { providerId: 'gemini-internal' }
            });
            if (geminiConn) {
                statuses['gemini-internal'] = {
                    id: 'gemini-internal',
                    name: 'Gemini Internal (CLI)',
                    status: 'offline',
                    available: false,
                    healthy: false,
                    valid: false,
                    connected: true,
                    accountEmail: geminiConn.accountEmail
                };
            }
        }

        // 3. Add status for connected but disabled Copilot
        if (!statuses['copilot']) {
            const copilotSetting = await prisma.systemSetting.findUnique({
                where: { key: 'GITHUB_COPILOT_TOKEN' }
            });
            if (copilotSetting && copilotSetting.value && copilotSetting.value.length > 10) {
                statuses['copilot'] = {
                    id: 'copilot',
                    name: 'Copilot',
                    status: 'offline',
                    available: false,
                    healthy: false,
                    valid: false,
                    connected: true
                };
            }
        }

        return statuses;
    }

    _logThrottled(key, logFn, intervalMs = 5000) {
        const now = Date.now();
        const last = this.lastLogTime.get(key) || 0;

        if (now - last > intervalMs) {
            logFn();
            this.lastLogTime.set(key, now);
        }
    }

    async executeWithRetry(provider, model, input, config) {
        const result = await this.requestQueue.add(() => provider.generateContent(input, { ...config, model }));

        // Record token usage if available
        if (result.usage) {
            const sessionId = config.sessionId || null;
            await tokenTracker.recordUsage(
                provider.id,
                model,
                result.usage,
                'chat',
                sessionId
            ).catch(err => {
                console.warn('[ModelManager] Failed to record token usage:', err.message);
            });
        }

        // Map result to pseudo-Gemini response format if needed for legacy code
        // Legacy code expects: result.response.text(), result.response.functionCalls()
        return {
            usedModel: model,
            usage: result.usage, // Pass through usage data
            response: {
                text: () => result.text,
                functionCalls: () => result.toolCalls || [],
                usageMetadata: result.usage // Also expose here for compatibility
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
