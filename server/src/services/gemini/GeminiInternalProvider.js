
import { GeminiHandshakeService } from './GeminiHandshakeService.js';
import { OAuth2Client } from 'google-auth-library';
import { retryService } from '../RetryService.js';
import { v4 as uuidv4 } from 'uuid';

const ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal';

const CLI_CLIENT_ID = process.env.GEMINI_CLI_CLIENT_ID;
const CLI_CLIENT_SECRET = process.env.GEMINI_CLI_CLIENT_SECRET;

export class GeminiInternalProvider {
    constructor(credentials) {
        this.id = 'gemini-internal';
        this.name = 'Gemini Internal (CLI)';
        this.models = [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.5-flash-lite',
            'gemini-3-pro-preview',
            'gemini-3-flash-preview'
        ];

        this.credentials = credentials;
        this.client = new OAuth2Client(CLI_CLIENT_ID, CLI_CLIENT_SECRET);
        if (credentials.access_token) {
            this.client.setCredentials(credentials);
        }

        this.handshakeService = new GeminiHandshakeService();
        this.projectId = null;
    }

    async initialize() {
        if (!this.credentials || !this.credentials.access_token) {
            console.warn('[GeminiInternal] No credentials provided.');
            return false;
        }
        try {
            this.projectId = await this.handshakeService.performHandshake(this.client, this.projectId);
            console.log('[GeminiInternal] Initialized with Project ID:', this.projectId);
            return true;
        } catch (e) {
            console.error('[GeminiInternal] Handshake failed:', e.message);
            return false;
        }
    }

    async listModels() {
        if (!this.projectId) await this.initialize();
        if (!this.projectId) return [];

        return this.models.map(m => {
            const prettyName = m
                .replace('gemini-', 'Gemini ')
                .replace('-', ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            return {
                id: m,
                name: m,
                displayName: `${prettyName} (CLI)`,
                provider: 'gemini-internal',
                description: 'Google Internal (Cloud Code)'
            };
        });
    }

    async generateContent(prompt, options = {}) {
        if (!this.projectId) await this.initialize();
        if (!this.projectId) throw new Error('Gemini Internal not initialized');

        let modelName = options.model || 'gemini-2.5-flash';
        if (modelName.includes(' (CLI)')) {
            modelName = modelName.replace(' (CLI)', '')
                .toLowerCase()
                .replace('gemini ', 'gemini-')
                .replace(' ', '-');
        }

        const history = options.history || [];
        const contents = history.map(msg => {
            const parts = [];
            if (msg.text || msg.content) {
                if (msg.role !== 'tool' && msg.role !== 'function') {
                    parts.push({ text: this._getString(msg.text || msg.content) });
                }
            }
            if (msg.role === 'model' && msg.toolCalls) {
                msg.toolCalls.forEach(tc => {
                    parts.push({
                        functionCall: {
                            name: tc.name,
                            args: tc.args || {}
                        }
                    });
                });
            }
            if (msg.role === 'tool' || msg.role === 'function') {
                let responseContent = {};
                try {
                    responseContent = JSON.parse(msg.content);
                } catch (e) {
                    responseContent = { result: msg.content };
                }
                parts.push({
                    functionResponse: {
                        name: msg.name,
                        response: responseContent
                    }
                });
            }
            if (parts.length === 0) {
                parts.push({ text: '' });
            }

            let role = 'user';
            if (msg.role === 'model') role = 'model';
            if (msg.role === 'tool' || msg.role === 'function') role = 'function';

            return { role, parts };
        });

        contents.push({ role: 'user', parts: [{ text: this._getString(prompt) }] });

        let tools = undefined;
        if (options.tools && options.tools.length > 0) {
            tools = [{
                functionDeclarations: options.tools.map(t => ({
                    name: t.name,
                    description: t.description || '',
                    parameters: t.parameters || { type: 'OBJECT', properties: {} }
                }))
            }];
        }

        let systemInstruction = undefined;
        if (options.systemInstruction) {
            systemInstruction = {
                parts: [{ text: options.systemInstruction }]
            };
        }

        const requestPayload = {
            model: modelName,
            project: this.projectId,
            user_prompt_id: uuidv4(),
            request: {
                contents: contents,
                system_instruction: systemInstruction,
                tools: tools,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192
                }
            }
        };

        if (options.tools) {
            console.log('[GeminiInternal] 📤 Sending Request with Tools:', JSON.stringify(requestPayload.request.tools, null, 2));
        }

        const url = `${ENDPOINT}:streamGenerateContent?alt=sse`;

        const res = await retryService.withRetry(async () => {
            return await this.client.request({
                url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
                responseType: 'stream'
            });
        }, { maxAttempts: 5, initialDelayMs: 2000, maxDelayMs: 20000 });

        return new Promise((resolve, reject) => {
            let fullText = '';
            let toolCalls = [];
            let lineBuffer = '';
            const stream = res.data;

            const processJson = (json) => {
                let candidates = json.candidates;
                if (!candidates && json.response && json.response.candidates) {
                    candidates = json.response.candidates;
                } else if (!candidates && json[0] && json[0].candidates) {
                    candidates = json[0].candidates;
                }
                if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
                    const parts = candidates[0].content.parts;
                    for (const part of parts) {
                        if (part.text) fullText += part.text;
                        if (part.functionCall) {
                            console.log(`[GeminiInternal] 🛠️ Detected Function Call: ${part.functionCall.name}`);
                            toolCalls.push({
                                name: part.functionCall.name,
                                args: part.functionCall.args || {}
                            });
                        }
                    }
                }
            };

            stream.on('data', (chunk) => {
                const str = lineBuffer + chunk.toString();
                const lines = str.split('\n');
                lineBuffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6).trim();
                            if (jsonStr === '[DONE]') continue;
                            if (jsonStr) processJson(JSON.parse(jsonStr));
                        } catch (e) {
                            console.warn('[GeminiInternal] Parse error on chunk:', e);
                        }
                    }
                }
            });

            stream.on('end', () => {
                if (lineBuffer.trim().startsWith('data: ')) {
                    try {
                        const jsonStr = lineBuffer.substring(6).trim();
                        if (jsonStr && jsonStr !== '[DONE]') processJson(JSON.parse(jsonStr));
                    } catch (e) { }
                }

                if (!fullText && toolCalls.length === 0) {
                    console.warn('[GeminiInternal] Warning: Response is empty after stream end.');
                } else {
                    console.log(`[GeminiInternal] Finished. Text: ${fullText.length} chars, Tools: ${toolCalls.length}`);
                }

                resolve({
                    text: (typeof fullText === 'string') ? fullText : '',
                    toolCalls: toolCalls.map(tc => ({
                        id: 'call_' + Math.random().toString(36).substr(2, 9),
                        name: tc.name,
                        args: tc.args
                    })),
                    usage: {
                        promptTokens: 0,
                        completionTokens: fullText.length,
                        totalTokens: fullText.length
                    }
                });
            });

            stream.on('error', (err) => reject(err));
        });
    }

    getDefaultModel() {
        return 'gemini-2.5-flash';
    }

    _getString(input) {
        if (!input) return '';
        if (typeof input === 'string') return input;
        if (Array.isArray(input)) return input.map(i => this._getString(i)).join('\n');
        if (typeof input === 'object') {
            if (input.text) return this._getString(input.text);
            if (input.content) return this._getString(input.content);
            return JSON.stringify(input);
        }
        return String(input);
    }
}
