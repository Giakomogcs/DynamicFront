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

            const { HybridModelFilter } = await import('./utils/HybridModelFilter.js');

            const filter = new HybridModelFilter({
                priority: [
                    'gpt-4o',
                    'gpt-4o-mini',
                    'o1',
                    'o1-mini'
                ],
                discovery: [
                    /^gpt-[4-9]/,           // GPT-4, 5, 6... variants
                    /^o[1-9]/,              // o1, o2... variants
                    /^chatgpt-[4-9]o/       // ChatGPT-4o... aliases
                ],
                exclude: [
                    'instruct',             // Instruct legacy
                    '0314', '0613',         // Old snapshots
                    'realtime',             // Realtime audio models
                    'audio',                // Audio
                    'tts',                  // Text to speech
                    'dall-e',               // Image only
                    'gpt-3.5',              // Legacy
                    'davinci', 'curie', 'babbage', 'ada', // Ancient
                    'transcribe',           // Audio transcription
                    'diarize',              // Audio diarization
                    'search',               // Search specific endpoints
                    'codex',                // Code specific (usually deprecated)
                    'embedding',
                    'mod'                   // Moderation models
                ]
            });

            return filter.process(data.data, m => m.id)
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    displayName: `OpenAI/${m.id}`,
                    provider: 'openai',
                    description: `OpenAI Model: ${m.id}`
                }));

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
