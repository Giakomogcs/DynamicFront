
import axios from 'axios';

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
                return res.data.map(m => ({
                    // Model names from GitHub are often like "gpt-4", "mistral-large"
                    // We prefix them to avoid collison or just use them as is if unique enough
                    // But ModelManager uses prefix in detection map.
                    name: `copilot/${m.name || m.id}`,
                    displayName: `(Copilot) ${m.name || m.id}`,
                    provider: 'copilot',
                    description: m.description || "GitHub Copilot Model"
                }));
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

        let modelName = config.model.replace('copilot/', ''); // Remove prefix

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
                messages.push({ role, content: h.parts[0].text });
            });
        }

        // Add current user message
        messages.push({ role: 'user', content: input });

        try {
            console.log(`[CopilotProvider] Calling model ${modelName}...`);
            const res = await axios.post(
                this.url,
                {
                    messages: messages,
                    model: modelName,
                    stream: false,
                    temperature: config.temperature || 0.7,
                    max_tokens: config.maxOutputTokens || 4096
                },
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
                const message = res.data.choices[0].message;
                return {
                    text: message.content,
                    toolCalls: [] // Copilot tool calling support? For now assume none or basic text
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
