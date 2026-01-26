
import { OpenAIProvider } from './OpenAIProvider.js';

export class GenericOpenAIProvider extends OpenAIProvider {
    constructor(config) {
        super(config);
        this.id = config.id || "generic";
        this.name = config.name || "Generic OpenAI";
        this.baseUrl = config.baseUrl; // Must be provided, e.g., "http://localhost:1234/v1"
        this.apiKey = config.apiKey || "sf-dummy"; // Many local LLMs don't need a real key, but some SDKs check it
    }

    async listModels() {
        if (!this.baseUrl) return [];
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { "Authorization": `Bearer ${this.apiKey}` }
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();

            // Handle different list formats (some are { data: [] }, some are [])
            const list = Array.isArray(data) ? data : (data.data || []);

            return list.map(m => ({
                id: m.id,
                name: m.id,
                displayName: `${this.name}/${m.id}`,
                provider: this.id, // e.g. 'lmstudio', 'ollama'
                description: `${this.name} Model: ${m.id}`
            }));
        } catch (e) {
            console.error(`[${this.name}] List models failed at ${this.baseUrl}:`, e.message);
            return [];
        }
    }
}
