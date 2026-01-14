
import axios from 'axios';
import { convertStandardToolsToOpenAI, convertOpenAIToolsToStandard } from './utils/GenericToolMapper.js';

export class CopilotProvider {
    constructor(config) {
        this.id = 'copilot';
        this.apiKey = config.apiKey; // This is the Access Token
        this.url = 'https://models.github.ai/inference/chat/completions';
    }

    async listModels() {
        try {
            // We use the catalog logic from copilotService, but reused here or duplicated
            const res = await axios.get("https://models.github.ai/catalog/models", {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28"
                }
            });

            if (Array.isArray(res.data)) {
                return res.data.map(m => {
                    // Use the id as the source of truth, fall back to name
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
            return [];
        }
    }

    async generateContent(input, config) {
        // Input: "User message"
        // Config: { model: 'copilot/gpt-4', history: [...], ... }

        // Remove prefix, but handle cases where model name might contain slashes naturally if needed (though unlikely for copilot catalog)
        let modelName = config.model;
        if (modelName.startsWith('copilot/')) {
            modelName = modelName.replace('copilot/', '');
        }

        // Prepare messages
        const messages = [];
        if (config.systemInstruction) {
            messages.push({ role: 'system', content: config.systemInstruction });
        }

        // Add history
        if (config.history && Array.isArray(config.history)) {
            config.history.forEach(h => {
                const role = h.role === 'model' ? 'assistant' : 'user';
                // Copilot (OpenAI format) expects string content usually
                messages.push({ role, content: h.parts ? h.parts[0].text : (h.content || "") });
            });
        }

        // Add current user message
        // Add current user message
        if (typeof input === 'string') {
            messages.push({ role: 'user', content: input });
        } else if (Array.isArray(input)) {
             // 2024-05-23: FIX for Copilot/OpenAI "Missing required parameter: 'messages[1].content[0].type'."
             // If input is an array (e.g. from Executor or multimodal context), we must map it to OpenAI Content Parts.
             const contentParts = input.map(part => {
                 // If the part is already a string, wrap it
                 if (typeof part === 'string') return { type: 'text', text: part };
                 
                 // If it's an object with 'text', ensure it has 'type: text'
                 if (part.text && !part.type) return { type: 'text', text: part.text };

                 // Using standard 'image_url' or other valid types if present
                 if (part.type) return part;

                 // Fallback: stringify unknown objects
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

        try {
            console.log(`[CopilotProvider] Calling model ${modelName}...`);
            const res = await axios.post(
                this.url,
                body,
                {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28"
                    }
                }
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
            // Standardize error for ModelManager
            const status = error.response?.status || 500;
            const msg = error.response?.data?.error?.message || error.message;
            const err = new Error(msg);
            err.status = status;
            throw err;
        }
    }
}
