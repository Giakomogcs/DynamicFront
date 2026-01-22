import { AIProvider } from '../AIProvider.js';
import { convertStandardToolsToOpenAI, convertOpenAIToolsToStandard } from './utils/GenericToolMapper.js';

export class OpenAIProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.id = "openai";
        this.name = "OpenAI";
        this.apiKey = config.apiKey;
        this.baseUrl = "https://api.openai.com/v1";
    }

    async listModels() {
        if (!this.apiKey) return [];
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { "Authorization": `Bearer ${this.apiKey}` }
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();

            const WHITELIST = [
                'gpt-4o',
                'gpt-4o-mini',
                'o1-preview',
                'o1-mini'
            ];

            return data.data
                .filter(m => WHITELIST.includes(m.id))
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    displayName: `OpenAI/${m.id}`,
                    provider: 'openai',
                    description: `OpenAI Model: ${m.id}`
                }))
                .sort((a, b) => WHITELIST.indexOf(a.id) - WHITELIST.indexOf(b.id));
        } catch (e) {
            console.error("[OpenAIProvider] List models failed:", e);
            return [];
        }
    }

    async generateContent(input, options = {}) {
        const modelName = options.model || "gpt-4-turbo-preview";

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
            temperature: options.temperature || 0.7
        };

        if (options.jsonMode) {
            body.response_format = { type: "json_object" };
        }

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
            throw new Error(`[OpenAI] ${response.status}: ${message}`);
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
