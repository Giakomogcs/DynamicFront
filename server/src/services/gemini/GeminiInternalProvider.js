
import { GeminiHandshakeService } from './GeminiHandshakeService.js';
import { OAuth2Client } from 'google-auth-library';
import { retryService } from '../RetryService.js'; // Assuming this exists or we mock it
import { v4 as uuidv4 } from 'uuid';

const ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal';

// Specific Client ID for the Internal API
// Specific Client ID for the Internal API (Hardcoded to match reference/auth.js)
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

        // This provider expects { access_token, refresh_token } in credentials
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
            // Test connection / Handshake
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

        /*
           Ideally we would fetch from the API here to get the true list of available models.
           However, the internal API endpoint is not well-documented and probing it risks errors.
           We fall back to the known hardcoded list from the reference implementation (ia-chat).
        */
        
        const models = this.models.map(m => {
            // Make name more human-readable and distinct
            const prettyName = m
                .replace('gemini-', 'Gemini ')
                .replace('-', ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            return {
                id: m,
                name: m, // Technical ID for routing
                displayName: `${prettyName} (CLI)`, // Pretty name for UI
                provider: 'gemini-internal',
                description: 'Google Internal (Cloud Code)'
            };
        });

        console.log(`[GeminiInternal] Loaded ${models.length} models:`, models.map(m => m.id).join(', '));
        return models;
    }


    // Interface for ModelManager
    async generateContent(prompt, options = {}) {
        if (!this.projectId) await this.initialize();
        if (!this.projectId) throw new Error('Gemini Internal not initialized');

        let modelName = options.model || 'gemini-2.5-flash';
        
        // Sanitization: Remove " (CLI)" or pretty formatting if passed accidentally
        if (modelName.includes(' (CLI)')) {
            modelName = modelName.replace(' (CLI)', '')
                .toLowerCase()
                .replace('gemini ', 'gemini-')
                .replace(' ', '-');
        }
        const history = options.history || []; // Message[]

        // Convert History to Gemini Format
        const contents = history.map(msg => {
            const parts = [];

            // 1. TEXT PART (Always possible)
            if (msg.text || msg.content) {
                // If it's a tool output, text might be JSONstring. Let's see below.
                if (msg.role !== 'tool' && msg.role !== 'function') {
                    parts.push({ text: this._getString(msg.text || msg.content) });
                }
            }

            // 2. MODEL TOOL CALLS
            if (msg.role === 'model' && msg.toolCalls) {
                // Map each tool call to functionCall part
                msg.toolCalls.forEach(tc => {
                    parts.push({
                        functionCall: {
                            name: tc.name, // Ensure no prefix if needed? Usually OK.
                            args: tc.args || {}
                        }
                    });
                });
            }

            // 3. TOOL RESPONSE (Function Return)
            if (msg.role === 'tool' || msg.role === 'function') {
                // Content is usually JSON string.
                // Structure: parts: [{ functionResponse: { name: "...", response: { ... } } }]
                let responseContent = {};
                try {
                    responseContent = JSON.parse(msg.content);
                } catch (e) {
                    responseContent = { result: msg.content };
                }

                parts.push({
                    functionResponse: {
                        name: msg.name, // Required to match the call
                        response: responseContent
                    }
                });
            }

            // Fallback: If no parts, add empty text to avoid error
            if (parts.length === 0) {
                parts.push({ text: '' });
            }

            // Role Mapping
            let role = 'user';
            if (msg.role === 'model') role = 'model';
            if (msg.role === 'tool' || msg.role === 'function') role = 'function'; // API expects 'function' for tool outputs

            return {
                role: role,
                parts: parts
            };
        });
        // Add current prompt
        contents.push({ role: 'user', parts: [{ text: this._getString(prompt) }] });

        // Map Tools
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

        // Map System Instruction
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
                system_instruction: systemInstruction, // Note: internal API uses snake_case often, check if systemInstruction vs system_instruction
                tools: tools,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192
                }
            }
        };

        const url = `${ENDPOINT}:streamGenerateContent?alt=sse`;

        // Execute with Retry
        const res = await retryService.withRetry(async () => {
             return await this.client.request({
                url: url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
                responseType: 'stream'
            });
        }, { maxAttempts: 5, initialDelayMs: 2000, maxDelayMs: 20000 });

        // Collect Stream
        return new Promise((resolve, reject) => {
            let fullText = '';
            let toolCalls = [];
            let lineBuffer = ''; // Buffer for incomplete lines

            const stream = res.data;

            const processJson = (json) => {
                let candidates = json.candidates;
                // Handle various response wrappers
                if (!candidates && json.response && json.response.candidates) {
                    candidates = json.response.candidates;
                } else if (!candidates && json[0] && json[0].candidates) {
                    candidates = json[0].candidates;
                }

                if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
                    const parts = candidates[0].content.parts;
                    for (const part of parts) {
                        if (part.text) {
                            fullText += part.text;
                        }
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
                
                // Keep the last line as remaining (might be incomplete)
                lineBuffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6).trim();
                            if (jsonStr === '[DONE]') continue;
                            if (!jsonStr) continue;

                            const json = JSON.parse(jsonStr);
                            processJson(json);

                        } catch (e) {
                             console.warn('[GeminiInternal] Parse error on chunk:', e);
                        }
                    }
                }
            });

            stream.on('end', () => {
                // Process remaining buffer if any
                if (lineBuffer.trim().startsWith('data: ')) {
                     try {
                        const jsonStr = lineBuffer.substring(6).trim();
                        if (jsonStr && jsonStr !== '[DONE]') {
                             const json = JSON.parse(jsonStr);
                             processJson(json);
                        }
                     } catch(e) {}
                }

                if (!fullText && toolCalls.length === 0) {
                    console.warn('[GeminiInternal] Warning: Response is empty after stream end.');
                } else {
                     console.log(`[GeminiInternal] Finished. Text: ${fullText.length} chars, Tools: ${toolCalls.length}`);
                }

                resolve({
                    response: {
                        text: () => {
                            // console.log(`[GeminiInternal] Accessing text. Length: ${fullText ? fullText.length : 'undefined'}`);
                            return fullText || ''; // Force string return
                        },
                        functionCalls: () => {
                            // console.log(`[GeminiInternal] Accessing functionCalls. Count: ${toolCalls ? toolCalls.length : 0}`);
                            return toolCalls || [];
                        }
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
        if (Array.isArray(input)) {
            return input.map(i => this._getString(i)).join('\n');
        }
        if (typeof input === 'object') {
            if (input.text) return this._getString(input.text);
            if (input.content) return this._getString(input.content);
            return JSON.stringify(input);
        }
        return String(input);
    }
}

