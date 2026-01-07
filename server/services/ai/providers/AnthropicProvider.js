import { AIProvider } from '../AIProvider.js';

export class AnthropicProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.id = "anthropic";
        this.name = "Anthropic (Claude)";
        this.apiKey = config.apiKey;
        this.baseUrl = "https://api.anthropic.com/v1";
        this.defaultVersion = "2023-06-01";
    }

    async listModels() {
        // Anthropic doesn't have a public List Models API like OpenAI yet (or it's limited).
        // We will return a static list if API key is present.
        if (!this.apiKey) return [];

        return [
            { id: "claude-3-opus-20240229", name: "claude-3-opus-20240229", displayName: "Claude 3 Opus", provider: "anthropic" },
            { id: "claude-3-sonnet-20240229", name: "claude-3-sonnet-20240229", displayName: "Claude 3 Sonnet", provider: "anthropic" },
            { id: "claude-3-haiku-20240307", name: "claude-3-haiku-20240307", displayName: "Claude 3 Haiku", provider: "anthropic" },
            { id: "claude-3-5-sonnet-latest", name: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet", provider: "anthropic" }
        ];
    }

    async generateContent(input, options = {}) {
        const modelName = options.model || "claude-3-haiku-20240307";

        let messages = [];
        let system = "";

        // Anthropic separates 'system' from messages array
        if (options.systemInstruction) {
            system = options.systemInstruction;
        }

        if (typeof input === 'string') {
            messages = [{ role: 'user', content: input }];
        } else if (Array.isArray(input)) {
            // Filter out system messages from history if they exist, move to system prop
            messages = input.filter(m => {
                if (m.role === 'system') {
                    if (!system) system = m.content;
                    return false;
                }
                return true;
            });
        }

        const body = {
            model: modelName,
            max_tokens: 4096,
            messages: messages,
            system: system,
            temperature: options.temperature || 0.7
        };

        const response = await fetch(`${this.baseUrl}/messages`, {
            method: "POST",
            headers: {
                "x-api-key": this.apiKey,
                "anthropic-version": this.defaultVersion,
                "content-type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            let errJson;
            try { errJson = JSON.parse(errText); } catch { }
            const message = errJson?.error?.message || errText;
            throw new Error(`[Anthropic] ${response.status}: ${message}`);
        }

        const data = await response.json();
        const textContent = data.content.find(c => c.type === 'text');

        return {
            text: textContent ? textContent.text : "",
            usage: {
                prompt_tokens: data.usage.input_tokens,
                completion_tokens: data.usage.output_tokens
            }
        };
    }
}
