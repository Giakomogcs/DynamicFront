import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from '../AIProvider.js';

export class GeminiProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.apiKey = config.apiKey;
        this.id = 'gemini';
        this.name = 'Google Gemini';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

        if (!config.apiKey) {
            console.warn("[GeminiProvider] No API Key provided.");
        }
        this.genAI = new GoogleGenerativeAI(config.apiKey);
    }

    getDefaultModel() {
        return 'gemini-2.0-flash';
    }

    async listModels() {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            if (!response.ok) throw new Error("Failed to fetch models");
            const data = await response.json();

            const WHITELIST = [
                //  Gemini 2.0 (Latest)
                'gemini-2.0-flash-exp',
                'gemini-2.0-flash-thinking-exp',
                'gemini-2.0-flash',

                // Gemini 1.5 (Stable)
                'gemini-1.5-pro',
                'gemini-1.5-pro-exp',
                'gemini-1.5-flash',
                'gemini-1.5-flash-8b',
                'gemini-1.5-flash-exp',

                // Experimental/Preview
                'gemini-exp-1206',
                'learnlm-1.5-pro-experimental'
            ];

            return (data.models || [])
                .filter(m => {
                    const id = m.name.replace('models/', '');
                    return m.supportedGenerationMethods.includes("generateContent") && WHITELIST.includes(id);
                })
                .map(m => ({
                    id: m.name.replace('models/', ''),
                    name: m.name.replace('models/', ''),
                    displayName: m.displayName,
                    provider: 'gemini',
                    description: m.description,
                    version: m.version
                }))
                .sort((a, b) => {
                    // Sort by WHITELIST order
                    const idA = a.name;
                    const idB = b.name;
                    return WHITELIST.indexOf(idA) - WHITELIST.indexOf(idB);
                });
        } catch (e) {
            console.warn("[GeminiProvider] List models failed:", e.message);
            return [];
        }
    }

    async generateContent(input, options = {}) {
        const modelName = options.model || "gemini-2.0-flash";
        const modelConfig = { model: modelName };
        if (options.systemInstruction) {
            modelConfig.systemInstruction = options.systemInstruction;
        }
        if (options.tools) {
            let mappedTools = options.tools;

            // Map inputSchema -> parameters (MCP to Gemini)
            if (Array.isArray(options.tools)) {
                mappedTools = options.tools.map(t => {
                    // Check if t is a tool object (not functionDeclarations wrapper)
                    if (t.name && (t.inputSchema || t.parameters)) {
                        const tool = {
                            name: t.name,
                            description: t.description,
                            parameters: t.inputSchema || t.parameters
                        };
                        // CRITICAL: Sanitize schema to remove invalid fields
                        return this._sanitizeToolSchema(tool);
                    }
                    return t;
                });
            }

            // Check if tools are already in Gemini format (should have functionDeclarations)
            // If it's a flat array of tools (like OpenAI format), wrap it.
            if (Array.isArray(mappedTools) && mappedTools.length > 0 && !mappedTools[0].functionDeclarations) {
                modelConfig.tools = [{ functionDeclarations: mappedTools }];
            } else {
                modelConfig.tools = mappedTools;
            }
        }
        if (options.jsonMode) {
            modelConfig.generationConfig = { responseMimeType: "application/json" };
        }

        const model = this.genAI.getGenerativeModel(modelConfig);

        // Handle Chat History (Array) vs Single Prompt (String)
        let result;
        if (Array.isArray(input)) {
            if (input.length === 0) {
                return await model.generateContent("Hello");
            }

            // Easier: Convert to history + last message
            const history = input.slice(0, -1).map(msg => ({
                role: this._mapRole(msg.role),
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            }));

            // Handle Tool Outputs in history? 
            // If the input array has 'function' roles, we need to map them to 'functionResponse' parts.
            // This logic is complex for Gemini SDK.
            // Alternative: Use `startChat` and reconstruct history correctly.

            // For now, let's assume we map standard roles.
            // Complex tool history reconstruction is tricky with SDK's strict validation.
            // We might need to handle tool outputs specifically.

            const lastMsg = input[input.length - 1];
            if (!lastMsg) return await model.generateContent("...");

            const chat = model.startChat({ history });

            // If last message is tool outputs, it's specific
            if (lastMsg.role === 'tool' || lastMsg.role === 'function') {
                // This is awkward in stateless generic interface.
                // Usually we send the WHOLE history `generateContent({ contents: [...] })`
                // Let's try `generateContent` with full contents instead of `startChat`.

                const contents = this._convertMessagesToGeminiContents(input);
                result = await model.generateContent({ contents });

            } else {
                // Standard user message
                result = await chat.sendMessage(lastMsg.content);
            }

        } else {
            // Single String
            result = await model.generateContent(input);
        }

        const response = await result.response;

        // Map Response to Standard Format
        const stdResponse = {
            text: response.text(),
            usage: response.usageMetadata
        };

        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            stdResponse.toolCalls = functionCalls.map(fc => ({
                name: fc.name,
                args: fc.args,
                id: 'call_' + Math.random().toString(36).substr(2, 9) // Gemini doesn't always provide IDs
            }));
        }

        return stdResponse;
    }

    /**
     * Sanitize tool schema for Gemini API compatibility
     * Gemini expects 'required' as an array at schema level, not in each property
     */
    _sanitizeToolSchema(tool) {
        if (!tool.parameters) return tool;

        const sanitized = { ...tool };

        // Deep clone parameters to avoid mutation
        sanitized.parameters = JSON.parse(JSON.stringify(tool.parameters));

        // Remove 'required' field from individual properties (Gemini doesn't accept this)
        if (sanitized.parameters.properties) {
            const cleanProps = {};
            for (const [key, value] of Object.entries(sanitized.parameters.properties)) {
                const cleanProp = { ...value };
                // Remove invalid fields that Gemini rejects
                delete cleanProp.required;
                cleanProps[key] = cleanProp;
            }
            sanitized.parameters.properties = cleanProps;
        }

        // Ensure 'required' is an array at the schema root level (if it exists)
        if (sanitized.parameters.required && !Array.isArray(sanitized.parameters.required)) {
            // If it's a boolean or other type, remove it
            delete sanitized.parameters.required;
        }

        return sanitized;
    }

    _mapRole(role) {
        if (role === 'user') return 'user';
        if (role === 'assistant' || role === 'model') return 'model';
        return 'user';
    }

    _convertMessagesToGeminiContents(messages) {
        return messages.map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'function',
                    parts: [{
                        functionResponse: {
                            name: m.name, // We need to store tool name in message history
                            response: { content: m.content }
                        }
                    }]
                };
            }
            return {
                role: this._mapRole(m.role),
                parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            };
        });
    }
}
