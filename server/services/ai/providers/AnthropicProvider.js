import { AIProvider } from '../AIProvider.js';
import { convertStandardToolsToAnthropic, convertAnthropicToolsToStandard } from './utils/GenericToolMapper.js';

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
        // Validation: Try to list models or perform a lightweight check
        if (!this.apiKey) return [];

        try {
            // Anthropic now supports a models endpoint
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": this.defaultVersion
                }
            });

            if (!response.ok) {
                // If endpoint fails (e.g. 401), treat as invalid key
                console.warn(`[AnthropicProvider] Validation failed: ${response.status}`);
                return [];
            }
            
            // If native list works, great! If not, we might fall back to static list BUT only if response was OK (meaning key is valid)
            // Currently Anthropic API returns models list.
            const data = await response.json();
             if (data && data.data) {
                 return data.data.map(m => ({
                     id: m.id,
                     name: m.id,
                     displayName: m.display_name || m.id,
                     provider: 'anthropic',
                     description: `Anthropic Model: ${m.id}`
                 }));
             }

             // If structure differs but auth worked, return static list as fallback
             return [
                { id: "claude-3-5-sonnet-latest", name: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet (Latest)", provider: "anthropic" },
                { id: "claude-3-5-haiku-latest", name: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku (Latest)", provider: "anthropic" },
                { id: "claude-3-opus-latest", name: "claude-3-opus-latest", displayName: "Claude 3 Opus (Latest)", provider: "anthropic" },
                { id: "claude-3-haiku-20240307", name: "claude-3-haiku-20240307", displayName: "Claude 3 Haiku (Legacy)", provider: "anthropic" }
            ];

        } catch (e) {
            console.warn("[AnthropicProvider] Validation/List failed:", e.message);
            return [];
        }
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

        // Tool Support
        if (options.tools && options.tools.length > 0) {
            const anthropicTools = convertStandardToolsToAnthropic(options.tools);
            if (anthropicTools.length > 0) {
                body.tools = anthropicTools;
            }
        }

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

        // Extract Tool Calls using Mapper
        const toolCalls = convertAnthropicToolsToStandard(data.content);

        return {
            text: textContent ? textContent.text : "",
            toolCalls: toolCalls,
            usage: {
                prompt_tokens: data.usage.input_tokens,
                completion_tokens: data.usage.output_tokens
            }
        };
    }
}
