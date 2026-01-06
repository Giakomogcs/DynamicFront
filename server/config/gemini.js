import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// FIX: Ensure SSL is ignored BEFORE any requests are made (ESM hoisting issue in api_server.js)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export class GeminiModelManager {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.error("CRITICAL: GEMINI_API_KEY is missing from .env");
        }
        this.genAI = new GoogleGenerativeAI(this.apiKey);

        // Load models from env or defaults
        // SAFETY GUARD: If env var is poisoned with "gemini-3" (which doesn't exist yet/anymore), force fallback.
        const envPrimary = process.env.GEMINI_MODEL_PRIMARY;
        if (envPrimary && envPrimary.includes('gemini-3')) {
            console.warn(`[GeminiManager] DETECTED INVALID MODEL '${envPrimary}' IN ENV. FALLING BACK TO 'gemini-2.0-flash'.`);
            this.primaryModelName = "gemini-2.0-flash";
        } else {
            this.primaryModelName = envPrimary || "gemini-2.0-flash";
        }

        const envSecondary = process.env.GEMINI_MODEL_SECONDARY;
        // Strip potential garbage from env if present (e.g. quotes or typos)
        let cleanSecondary = envSecondary ? envSecondary.replace(/[^a-zA-Z0-9-._]/g, '') : null;

        if (cleanSecondary && cleanSecondary.includes('gemini-3')) {
            this.secondaryModelName = "gemini-2.0-flash-lite";
        } else {
            this.secondaryModelName = cleanSecondary || "gemini-2.0-flash-lite";
        }

        // Rate Limiting Queue
        // Free tier varies: 1.5 Flash (15 RPM), 1.5 Pro (2 RPM), 2.0 Flash (15 RPM?), 2.5 Flash (5 RPM?)
        // Safest common denominator is 5 RPM (12s interval).
        // INCREASED to 15 RPM for Flash as per standard tiers, but queue will handle 429s gracefully.
        this.requestQueue = new RequestQueue(15);

        console.log("[GeminiManager] Initialized.");
        console.log(`[GeminiManager] Primary Model: ${this.primaryModelName}`);
        console.log(`[GeminiManager] Secondary Model: ${this.secondaryModelName}`);
        console.log(`[GeminiManager] API Key Present: ${!!this.apiKey}`);
    }

    async listAvailableModels() {
        try {
            console.log("[GeminiManager] Fetching available models...");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${await response.text()}`);
            }
            const data = await response.json();
            const models = data.models || [];

            // Filter for models that support generateContent
            const viableModels = models
                .filter(m => m.supportedGenerationMethods.includes("generateContent"))
                .filter(m => {
                    const lowerName = (m.name + m.displayName).toLowerCase();
                    return !lowerName.includes("banana") && !lowerName.includes("deepsearch") && !lowerName.includes("deep research");
                })
                .sort((a, b) => {
                    // Sort by version desc (rough heuristic) ? Or just name.
                    return b.name.localeCompare(a.name);
                });

            console.log("------------------------------------------------");
            console.log("AVAILABLE GEMINI MODELS (generateContent):");
            console.log("------------------------------------------------");
            viableModels.forEach(m => {
                console.log(`- ${m.name} (${m.version}) [${m.displayName}]`);
            });
            console.log("------------------------------------------------");

            return viableModels;
        } catch (error) {
            console.error("[GeminiManager] Error listing models:", error.message);
            return [];
        }
    }

    getPrimaryModel(config = {}) {
        return this.genAI.getGenerativeModel({
            model: this.primaryModelName,
            ...config
        });
    }

    getSecondaryModel(config = {}) {
        return this.genAI.getGenerativeModel({
            model: this.secondaryModelName,
            ...config
        });
    }

    /**
     * QUEUED Execution Wrapper
     * Use this to wrap any API call that needs to be rate-limited.
     * @param {Function} taskFn - () => Promise<Result>
     */
    async executeQueuedRequest(taskFn) {
        return this.requestQueue.add(taskFn);
    }

    /**
     * Helper to execute a standard prompt with failover
     */
    async generateContentWithFailover(prompt, config = {}) {
        try {
            const model = this.getPrimaryModel(config);
            // Use Queue with closure
            return await this.executeQueuedRequest(() => model.generateContent(prompt));
        } catch (error) {
            // IF the user explicitly requested a model, DO NOT switch to secondary.
            // The user wants THAT model. The queue retry logic should have already tried a few times.
            if (config.model && config.model !== this.primaryModelName) {
                console.error(`[GeminiManager] User-selected model '${config.model}' failed. NOT falling back to secondary. Error: ${error.message}`);
                throw error;
            }

            console.warn(`[GeminiManager] Primary model failed. Trying secondary (${this.secondaryModelName}). Error: ${error.message}`);

            try {
                // FALLBACK: Remove 'model' override from config to ensure we use the explicit secondary model
                const safeConfig = { ...config };
                delete safeConfig.model;

                const model = this.getSecondaryModel(safeConfig);
                // Use Queue with closure
                return await this.executeQueuedRequest(() => model.generateContent(prompt));
            } catch (secError) {
                console.error(`[GeminiManager] Secondary model also failed.`, secError);
                throw secError;
            }
        }
    }
}

/**
 * Simple Token Bucket / Interval Queue
 */
class RequestQueue {
    constructor(rpm) {
        this.rpm = rpm;
        this.delayBetweenRequests = Math.ceil(60000 / rpm); // 12000ms for 5 RPM
        this.queue = [];
        this.processing = false;
        this.lastRequestTime = 0;
    }

    add(asyncTask) {
        return new Promise((resolve, reject) => {
            this.queue.push({ asyncTask, resolve, reject, retries: 0 });
            this.process();
        });
    }

    async process() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue[0]; // Peek, don't shift yet in case we need to retry in-place

            const now = Date.now();
            const timeSinceLast = now - this.lastRequestTime;

            if (timeSinceLast < this.delayBetweenRequests) {
                const waitTime = this.delayBetweenRequests - timeSinceLast;
                if (waitTime > 100) { // Only log significant waits
                    console.log(`[RequestQueue] Throttling... waiting ${waitTime}ms`);
                }
                await new Promise(r => setTimeout(r, waitTime));
            }

            try {
                this.lastRequestTime = Date.now();
                // Execute
                const result = await item.asyncTask();

                // Success - remove from queue and resolve
                this.queue.shift();
                item.resolve(result);

            } catch (e) {
                // Handling 429 Too Many Requests
                if (e.message.includes('429') || e.message.includes('Too Many Requests') || e.status === 429) {
                    console.warn(`[RequestQueue] Hit Rate Limit (429). Retries: ${item.retries}`);

                    if (item.retries < 3) {
                        item.retries++;
                        // Backoff strategy: 10s, 20s, 40s
                        const backoff = 10000 * Math.pow(2, item.retries - 1);
                        console.log(`[RequestQueue] Backing off for ${backoff}ms before retry...`);

                        // Wait before retrying THIS item (blocking the queue)
                        // This is correct because if one fails, others will likely fail too.
                        await new Promise(r => setTimeout(r, backoff));

                        // Loop will continue and try this item again (since we didn't shift it)
                        continue;
                    }
                }

                // Fatal error or max retries exceeded
                console.error(`[RequestQueue] Task Failed: ${e.message}`);
                this.queue.shift(); // Remove
                item.reject(e);
            }
        }

        this.processing = false;
    }
}

export const geminiManager = new GeminiModelManager();
// Fire and forget: list models on startup to help debugging
geminiManager.listAvailableModels();
