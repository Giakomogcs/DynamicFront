import { AIProvider } from '../AIProvider.js';

export class GroqProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.id = "groq";
        this.name = "Groq High-Performance";
        this.apiKey = config.apiKey;
        this.baseUrl = "https://api.groq.com/openai/v1";
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
                displayName: `Groq/${m.id}`,
                provider: 'groq',
                description: `Groq hosted model: ${m.id}`
            }));
        } catch (e) {
            console.error("[GroqProvider] List models failed:", e);
            return [];
        }
    }

    async generateContent(input, options = {}) {
        const modelName = options.model || "llama3-70b-8192";

        let messages = [];
        if (typeof input === 'string') {
            messages = [{ role: 'user', content: input }];
        } else if (Array.isArray(input)) {
            messages = input;
        }

        if (options.systemInstruction) {
            messages.unshift({ role: 'system', content: options.systemInstruction });
        }

        const body = {
            model: modelName,
            messages: messages,
            temperature: options.temperature || 0.7
        };

        if (options.jsonMode) {
            body.response_format = { type: "json_object" };
        }

        // Groq Tool calling (OpenAI compatible) support
        // Note: Groq supports tool_calls in recent models
        if (options.tools && options.tools.length > 0) {
            // Need to convert Gemini/MCP tools to OpenAI format
            // options.tools passed from Executor might be in Gemini format [{functionDeclarations:[...]}]
            // This conversion is tricky. For now, assuming Groq is used primarily for text/logic or we map tools.
            // If tools are in Gemini format, ignore or warn?
            // TODO: Implement Tool Mapper
            // console.warn("[GroqProvider] Tools passed but conversion not implemented yet.");
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
            const code = response.status;
            throw new Error(`[Groq] ${code}: ${message}`);
        }

        const data = await response.json();
        const choice = data.choices[0];

        return {
            text: choice.message.content,
            toolCalls: choice.message.tool_calls, // OpenAI format
            usage: data.usage
        };
    }
}
