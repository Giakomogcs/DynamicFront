
import axios from 'axios';
import { convertStandardToolsToOpenAI, convertOpenAIToolsToStandard } from './utils/GenericToolMapper.js';
import { copilotService } from '../../copilotService.js';

export class CopilotProvider {
    constructor(config) {
        this.id = 'copilot';
        this.apiKey = config.apiKey ? config.apiKey.trim() : ""; // OAuth token (gho_) or Internal Token (tid_)
        this.url = 'https://api.githubcopilot.com/chat/completions'; // Default

        // Cache for exchanged token
        this.sessionToken = null;
        this.tokenExpiresAt = 0;
        this.sessionEndpoint = null;
    }

    getDefaultModel() {
        return 'gpt-4';
    }

    async listModels() {
        try {
            // Ensure we have a valid session token if possible
            await this.ensureSessionToken();
            const tokenToUse = this.sessionToken || this.apiKey;

            // Pass the potentially exchanged token to service
            const models = await copilotService.getModels(tokenToUse);

            const { HybridModelFilter } = await import('./utils/HybridModelFilter.js');
            const filter = new HybridModelFilter({
                priority: [
                    'gpt-4o',
                    'claude-3.5-sonnet'
                ],
                discovery: [], // Strict Mode to prevent clutter
                exclude: []
            });

            if (Array.isArray(models)) {
                // Copilot models usually have 'id' or 'name'
                const filtered = filter.process(models, m => m.id || m.name);

                return filtered.map(m => {
                    const modelId = m.id || m.name;
                    return {
                        name: `copilot/${modelId}`,
                        displayName: `(Copilot) ${m.name || modelId}`,
                        provider: 'copilot',
                        description: m.description || "GitHub Copilot Model"
                    };
                });
            }
            return [];
        } catch (e) {
            console.warn("[CopilotProvider] Failed to list models:", e.message);
            // Fallback: Return empty list if validation fails
            return [];
        }
    }

    async ensureSessionToken() {
        // If we already have a valid session token, do nothing
        if (this.sessionToken && Date.now() < this.tokenExpiresAt) {
            return;
        }

        // Only attempt exchange if it looks like an OAuth token (gho_) OR if we haven't tried yet.
        // But to be safe and match ia-chat, we try exchange if provided key is NOT a tid_ token?
        // Actually ia-chat assumes input IS oauthToken.
        // Let's try exchange if it starts with gho_
        if (this.apiKey.startsWith('gh')) {
            try {
                const exchangeData = await copilotService.exchangeToken(this.apiKey);
                this.sessionToken = exchangeData.token; // tid_...
                this.tokenExpiresAt = (exchangeData.expires_at || (Date.now() / 1000 + 1500)) * 1000;

                if (exchangeData.endpoints && exchangeData.endpoints.api) {
                    this.sessionEndpoint = `${exchangeData.endpoints.api}/chat/completions`;
                } else {
                    this.sessionEndpoint = this.url;
                }
                console.log(`[CopilotProvider] Token exchanged. Expires at: ${new Date(this.tokenExpiresAt).toISOString()}`);
            } catch (err) {
                console.error("[CopilotProvider] Token exchange failed:", err.message);
                // Fallback: assume apiKey is the session token or try to use it directly
                this.sessionToken = this.apiKey;
                this.sessionEndpoint = this.url;
                // Don't set expiration so we retry next time if maybe transient? 
                // Or set short expiry? Let's leave it.
            }
        } else {
            // Assume it's already a session token (tid_) or we just try using it
            if (!this.sessionToken) {
                this.sessionToken = this.apiKey;
                this.sessionEndpoint = this.url;
            }
        }
    }

    async generateContent(input, config) {
        let modelName = config.model;
        if (modelName.startsWith('copilot/')) {
            modelName = modelName.replace('copilot/', '');
        }

        // Remap unsupported/hallucinated models to standard gpt-4
        if (modelName.includes('gpt-5') || modelName === 'gpt-5-mini') {
            console.warn(`[CopilotProvider] ⚠️ Model '${modelName}' is not supported. Remapping to 'gpt-4'.`);
            modelName = 'gpt-4';
        }

        // refresh/ensure token
        await this.ensureSessionToken();

        const finalToken = this.sessionToken || this.apiKey;
        const finalEndpoint = this.sessionEndpoint || this.url;

        // Debug Log (Masked)
        const tokenPreview = finalToken ? (finalToken.substring(0, 4) + '...' + finalToken.substring(finalToken.length - 4)) : 'NONE';
        console.log(`[CopilotProvider] Using token: ${tokenPreview}`);

        // Prepare messages
        const messages = [];
        if (config.systemInstruction) {
            messages.push({ role: 'system', content: config.systemInstruction });
        }

        // Add history
        if (config.history && Array.isArray(config.history)) {
            config.history.forEach(h => {
                const role = h.role === 'model' ? 'assistant' : 'user';
                messages.push({ role, content: h.parts ? h.parts[0].text : (h.content || "") });
            });
        }

        // Add current user message
        if (typeof input === 'string') {
            messages.push({ role: 'user', content: input });
        } else if (Array.isArray(input)) {
            const contentParts = input.map(part => {
                if (typeof part === 'string') return { type: 'text', text: part };
                if (part.text && !part.type) return { type: 'text', text: part.text };
                if (part.type) return part;
                return { type: 'text', text: JSON.stringify(part) };
            });
            messages.push({ role: 'user', content: contentParts });
        }

        const body = {
            messages: messages,
            model: modelName,
            stream: false,
            temperature: config.temperature || 0.7,
            max_tokens: config.maxOutputTokens || 4096
        };

        // Tool Support
        if (config.tools && config.tools.length > 0) {
            const openAITools = convertStandardToolsToOpenAI(config.tools);
            if (openAITools.length > 0) {
                body.tools = openAITools;
                body.tool_choice = "auto";
            }
        }

        // GitHub Copilot Headers (based on ia-chat reference)
        const headers = {
            "Authorization": `Bearer ${finalToken}`,
            "Content-Type": "application/json",
            "Copilot-Integration-Id": "vscode-chat",
            "Accept": "application/json",
            "User-Agent": "GeminiChat-App/1.0",
            "Editor-Version": "vscode/1.85.0",
            "Editor-Plugin-Version": "copilot/1.145.0"
        };

        try {
            console.log(`[CopilotProvider] Calling model ${modelName} at ${finalEndpoint}...`);
            const res = await axios.post(
                finalEndpoint,
                body,
                { headers }
            );

            if (res.data && res.data.choices && res.data.choices.length > 0) {
                const choice = res.data.choices[0];
                return {
                    text: choice.message.content,
                    toolCalls: convertOpenAIToolsToStandard(choice.message.tool_calls) // Standardize
                };
            }

            throw new Error("No response content from Copilot");

        } catch (error) {
            console.error(`[CopilotProvider] Error:`, error.response?.data || error.message);
            const status = error.response?.status || 500;
            const msg = error.response?.data?.error?.message || error.message;
            const err = new Error(msg);
            err.status = status;
            throw err;
        }
    }
}
