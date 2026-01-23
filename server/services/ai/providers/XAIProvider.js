import { AIProvider } from '../AIProvider.js';
import { convertStandardToolsToOpenAI, convertOpenAIToolsToStandard } from './utils/GenericToolMapper.js';

export class XAIProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.id = "xai";
        this.name = "xAI (Grok)";
        this.apiKey = config.apiKey;
        this.baseUrl = "https://api.x.ai/v1";
    }

    async listModels() {
        if (!this.apiKey) return this.getDefaultModels();
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { "Authorization": `Bearer ${this.apiKey}` }
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();

            const { HybridModelFilter } = await import('./utils/HybridModelFilter.js');

            const filter = new HybridModelFilter({
                priority: [
                    'grok-2-1212'
                ],
                discovery: [], // Strict Mode (Grok beta is older)
                exclude: ['beta']
            });

            const filtered = filter.process(data.data, m => m.id);

            if (filtered.length === 0) return this.getDefaultModels();

            return filtered.map(m => ({
                id: m.id,
                name: m.id,
                displayName: `xAI/${m.id}`,
                provider: 'xai',
                description: `Grok Model: ${m.id}`
            }));

        } catch (e) {
            // ... error handling ...
            let msg = e.message;
            try {
                // Try to parse xAI JSON error for cleaner logging
                const jsonErr = JSON.parse(msg);
                if (jsonErr.error) {
                    console.warn(`[XAIProvider] Could not load models: ${jsonErr.error}`);
                    return this.getDefaultModels();
                }
            } catch { }

            console.warn("[XAIProvider] List models failed:", msg);
            // Return empty list on failure, do NOT fallback to defaults if auth failed
            return [];
        }
    }

    getDefaultModels() {
        return [
            {
                id: 'grok-beta',
                name: 'grok-beta',
                displayName: 'Grok Beta',
                provider: 'xai',
                description: 'xAI Grok Beta Model'
            },
            {
                id: 'grok-2-1212',
                name: 'grok-2-1212',
                displayName: 'Grok 2 (Latest)',
                provider: 'xai',
                description: 'xAI Grok 2 Latest'
            }
        ];
    }

    async generateContent(input, options = {}) {
        const modelName = options.model || "grok-beta";

        let messages = [];
        if (typeof input === 'string') {
            messages = [{ role: 'user', content: input }];
        } else if (Array.isArray(input)) {
            messages = input.map(msg => ({
                ...msg,
                role: msg.role === 'model' ? 'assistant' : msg.role
            }));
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

        // Tool Support
        if (options.tools && options.tools.length > 0) {
            const openAITools = convertStandardToolsToOpenAI(options.tools);
            if (openAITools.length > 0) {
                body.tools = openAITools;
                body.tool_choice = "auto";
            }
        }

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
            toolCalls: convertOpenAIToolsToStandard(choice.message.tool_calls),
            usage: data.usage
        };
    }
}
