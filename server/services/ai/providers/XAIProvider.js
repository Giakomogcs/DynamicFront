import { AIProvider } from '../AIProvider.js';

export class XAIProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.id = "xai";
        this.name = "xAI (Grok)";
        this.apiKey = config.apiKey;
        this.baseUrl = "https://api.x.ai/v1";
    }

    async listModels() {
        if (!this.apiKey) return [];
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { "Authorization": `Bearer ${this.apiKey}` }
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();

            return data.data.map(m => ({
                id: m.id,
                name: m.id,
                displayName: `xAI/${m.id}`,
                provider: 'xai',
                description: `Grok Model: ${m.id}`
            }));
        } catch (e) {
            console.error("[XAIProvider] List models failed:", e);
            return [];
        }
    }

    async generateContent(input, options = {}) {
        const modelName = options.model || "grok-beta";

        let messages = [];
        if (typeof input === 'string') {
            messages = [{ role: 'user', content: input }];
        } else if (Array.isArray(input)) {
            messages = input;
        }

        if (options.systemInstruction) {
            messages = [{ role: 'system', content: options.systemInstruction }, ...messages];
        }

        const body = {
            model: modelName,
            messages: messages,
            temperature: options.temperature || 0.7,
            stream: false
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            let errJson;
            try { errJson = JSON.parse(errText); } catch { }
            const message = errJson?.error?.message || errText;
            throw new Error(`[xAI] ${response.status}: ${message}`);
        }

        const data = await response.json();
        const choice = data.choices[0];

        return {
            text: choice.message.content,
            toolCalls: choice.message.tool_calls,
            usage: data.usage
        };
    }
}
