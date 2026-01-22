import { AIProvider } from '../AIProvider.js';
import { convertStandardToolsToOpenAI, convertOpenAIToolsToStandard } from './utils/GenericToolMapper.js';

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

            const WHITELIST = [
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant',
                'mixtral-8x7b-32768'
            ];

            return data.data
                .filter(m => WHITELIST.includes(m.id))
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    displayName: `Groq/${m.id}`,
                    provider: 'groq',
                    description: `Groq hosted model: ${m.id}`
                }))
                .sort((a, b) => WHITELIST.indexOf(a.id) - WHITELIST.indexOf(b.id));
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

        // SANITIZE HISTORY: Ensure strict OpenAI compatibility for Tools
        messages = this._sanitizeHistory(messages);

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

        if (options.tools && options.tools.length > 0) {
            const openAITools = convertStandardToolsToOpenAI(options.tools);
            if (openAITools.length > 0) {
                body.tools = openAITools;
                // FORCE tool usage if tools are provided. This prevents "I would do this..." responses.
                // We trust the Planner; if it sent tools, they should be used.
                body.tool_choice = "required";
                console.log("[GroqProvider] Converted Tools Payload (Snippet):", JSON.stringify(body.tools).substring(0, 500) + "...");
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
            const code = response.status;
            throw new Error(`[Groq] ${code}: ${message}`);
        }

        const data = await response.json();
        const choice = data.choices[0];

        return {
            text: choice.message.content,
            toolCalls: convertOpenAIToolsToStandard(choice.message.tool_calls), // OpenAI format -> Standard format
            usage: data.usage
        };
    }

    _sanitizeHistory(history) {
        if (!Array.isArray(history)) return history;

        const sanitized = [];
        // Map to ensure deep copy and standard roles
        let cleanHistory = history.map(h => {
            // Basic Role Mapping
            let role = h.role === 'model' ? 'assistant' : h.role;
            if (role === 'tool') role = 'tool'; // Ensure tool stays tool

            // Content handling
            let content = h.content;
            if (typeof content !== 'string' && content !== null) {
                content = JSON.stringify(content);
            }
            if (content === null && role === 'assistant' && (!h.toolCalls || h.toolCalls.length === 0)) {
                // OpenAI does not allow null content for assistant unless there are tool calls
                content = "";
            }

            return { ...h, role, content };
        });

        // 1. Assign IDs to all tool calls (if missing) and link them
        // Llama 3 / OpenAI requires:
        // Assistant Message: tool_calls: [{ id: "call_1", ... }]
        // Tool Message: tool_call_id: "call_1"

        let callIdMap = new Map(); // name -> last_id (Simple heuristic if strictly linear)

        for (let i = 0; i < cleanHistory.length; i++) {
            const msg = cleanHistory[i];

            // A. If Assistant has toolCalls (Gemini format comes as 'toolCalls' property usually from Executor injection)
            if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                // Convert Gemini-style "toolCalls" to OpenAI "tool_calls"
                const openAIToolCalls = [];

                msg.toolCalls.forEach((tc, idx) => {
                    // If it already has an ID, use it. If not, generate one.
                    const callId = tc.id || `call_${Date.now()}_${i}_${idx}`;

                    if (!callIdMap.has(tc.name)) {
                        callIdMap.set(tc.name, []);
                    }
                    callIdMap.get(tc.name).push(callId);

                    openAIToolCalls.push({
                        id: callId,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.args || {})
                        }
                    });
                });

                msg.tool_calls = openAIToolCalls;
                // OpenAI: If tool_calls present, content must be null or string.
                if (!msg.content) msg.content = null;
                delete msg.toolCalls; // Remove non-standard property
            }

            // B. If Tool Response (role: tool)
            if (msg.role === 'tool') {
                const toolName = msg.name;

                if (toolName && callIdMap.has(toolName) && callIdMap.get(toolName).length > 0) {
                    // Pop the ID
                    msg.tool_call_id = callIdMap.get(toolName).shift();
                } else {
                    console.warn(`[GroqProvider] ⚠️ Orphaned tool response found for ${toolName}. Attempting to patch history...`);
                    msg.tool_call_id = `call_patched_${Date.now()}_${i}`;
                }
            }

            sanitized.push(msg);
        }

        return sanitized;
    }
}
