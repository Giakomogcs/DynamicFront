
import { GeminiHandshakeService } from './GeminiHandshakeService.js';
import { OAuth2Client } from 'google-auth-library';
import { retryService } from '../../services/RetryService.js'; // Assuming this exists or we mock it
import { v4 as uuidv4 } from 'uuid';

const ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal';

// Specific Client ID for the Internal API
const CLI_CLIENT_ID = process.env.GEMINI_CLI_CLIENT_ID;
const CLI_CLIENT_SECRET = process.env.GEMINI_CLI_CLIENT_SECRET;

export class GeminiInternalProvider {
    constructor(credentials) {
        this.id = 'gemini-internal';
        this.name = 'Gemini Internal (CLI)';
        this.models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview'];
        
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
        
        return this.models.map(m => ({
            id: m,
            name: m,
            provider: 'gemini-internal',
            description: 'Google Internal (Cloud Code)'
        }));
    }
    
    // Interface for ModelManager
    async generateContent(prompt, options = {}) {
        if (!this.projectId) await this.initialize();
        if (!this.projectId) throw new Error('Gemini Internal not initialized');

        const modelName = options.model || 'gemini-2.5-flash';
        const history = options.history || []; // Message[]

        // Convert History to Gemini Format
        const contents = history.map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.text || msg.content }]
        }));
        
        // Add current prompt
        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const requestPayload = {
            model: modelName,
            project: this.projectId,
            user_prompt_id: uuidv4(),
            request: {
                contents: contents,
                generationConfig: { temperature: 0.7 },
                tools: undefined // TODO: Add tools support
            }
        };

        const url = `${ENDPOINT}:streamGenerateContent?alt=sse`;

        // We need to handle SSE (Server Sent Events)
        // For simplicity in this v1, we'll wait for the full response if possible or gather chunks
        // But the internal API *only* supports streamGenerateContent according to the guide?
        // Actually guide says "streamGenerateContent?alt=sse".
        
        const res = await this.client.request({
            url: url,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            responseType: 'stream'
        });

        // Collect Stream
        return new Promise((resolve, reject) => {
            let fullText = '';
            const stream = res.data;
            
            stream.on('data', (chunk) => {
                const str = chunk.toString();
                // Parse SEE data: line starts with "data: "
                const lines = str.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6).trim();
                            if (jsonStr === '[DONE]') continue;
                            const json = JSON.parse(jsonStr);
                            
                            // Extract text
                           if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
                               const part = json.candidates[0].content.parts[0];
                               if (part.text) fullText += part.text;
                           }
                        } catch (e) { 
                            // ignore parse errors for partial chunks 
                        }
                    }
                }
            });

            stream.on('end', () => {
                resolve({
                    response: {
                        text: () => fullText
                    }
                });
            });

            stream.on('error', (err) => reject(err));
        });
    }

    getDefaultModel() {
        return 'gemini-2.5-flash';
    }
}
