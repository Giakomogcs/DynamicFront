
/**
 * Sanitizes JSON Schema for OpenAI/Anthropic compatibility.
 * Recursively lowercases types and removes unsupported fields.
 */
function sanitizeSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const newSchema = { ...schema };

    if (newSchema.type && typeof newSchema.type === 'string') {
        newSchema.type = newSchema.type.toLowerCase();
    }

    if (newSchema.properties) {
        newSchema.properties = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            newSchema.properties[key] = sanitizeSchema(prop);
        }
    }

    if (newSchema.items) {
        newSchema.items = sanitizeSchema(newSchema.items);
    }

    return newSchema;
}

/**
 * Converts Gemini/Google AI Tool format to OpenAI/Groq Tool format.
 */
export function convertGeminiToolsToOpenAI(geminiTools) {
    if (!geminiTools || !Array.isArray(geminiTools)) return [];

    const openAITools = [];

    for (const toolGroup of geminiTools) {
        if (toolGroup.functionDeclarations) {
            for (const func of toolGroup.functionDeclarations) {
                openAITools.push({
                    type: "function",
                    function: {
                        name: func.name,
                        description: func.description,
                        parameters: sanitizeSchema(func.parameters || { type: "object", properties: {} })
                    }
                });
            }
        }
    }

    return openAITools;
}

/**
 * Converts OpenAI/Groq Tool Calls to Gemini/Google AI Function Call format.
 * 
 * OpenAI Format:
 * [
 *   {
 *     id: "call_123",
 *     type: "function",
 *     function: { name: "func_name", arguments: "{\"key\": \"val\"}" }
 *   }
 * ]
 * 
 * Gemini Format:
 * [
 *   {
 *     name: "func_name",
 *     args: { key: "val" }
 *   }
 * ]
 */
export function convertOpenAIToolsToGemini(openAIToolCalls) {
    if (!openAIToolCalls || !Array.isArray(openAIToolCalls)) return [];

    return openAIToolCalls.map(call => {
        try {
            return {
                name: call.function.name,
                args: JSON.parse(call.function.arguments || "{}")
            };
        } catch (e) {
            console.error(`[ToolMapper] Failed to parse arguments for tool ${call.function?.name}:`, e);
            return {
                name: call.function?.name || "unknown",
                args: {}
            };
        }
    });
}

/**
 * Converts Gemini Tools to Anthropic Format (Claude 3).
 */
export function convertGeminiToolsToAnthropic(geminiTools) {
    if (!geminiTools || !Array.isArray(geminiTools)) return [];

    const anthropicTools = [];
    for (const toolGroup of geminiTools) {
        if (toolGroup.functionDeclarations) {
            for (const func of toolGroup.functionDeclarations) {
                anthropicTools.push({
                    name: func.name,
                    description: func.description,
                    input_schema: sanitizeSchema(func.parameters || { type: "object", properties: {} })
                });
            }
        }
    }
    return anthropicTools;
}

/**
 * Converts Anthropic Tool Use Response to Gemini Function Call format.
 * Anthropic Content Array -> Gemini Function Calls
 */
export function convertAnthropicToolsToGemini(anthropicContent) {
    if (!anthropicContent || !Array.isArray(anthropicContent)) return [];

    return anthropicContent
        .filter(block => block.type === 'tool_use')
        .map(block => ({
            name: block.name,
            args: block.input || {}
        }));
}
