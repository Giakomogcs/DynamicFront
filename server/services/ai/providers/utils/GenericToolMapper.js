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
 * Converts Standard AI Model Tool format to OpenAI/Groq Tool format.
 */
export function convertStandardToolsToOpenAI(standardTools) {
    if (!standardTools || !Array.isArray(standardTools)) return [];

    const openAITools = [];

    for (const tool of standardTools) {
        openAITools.push({
            type: "function",
            function: {
                name: tool.name,
                description: (tool.description || "").substring(0, 1024), // Truncate to avoid context limit / safety triggers
                parameters: sanitizeSchema(tool.parameters || { type: "object", properties: {} })
            }
        });
    }

    return openAITools;
}

/**
 * Converts OpenAI/Groq Tool Calls to Standard Function Call format.
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
 * Standard Format:
 * [
 *   {
 *     name: "func_name",
 *     args: { key: "val" }
 *   }
 * ]
 */
export function convertOpenAIToolsToStandard(openAIToolCalls) {
    if (!openAIToolCalls || !Array.isArray(openAIToolCalls)) return [];

    return openAIToolCalls.map(call => {
        try {
            return {
                id: call.id, // Preserve ID if available for history patching
                name: call.function.name,
                args: JSON.parse(call.function.arguments || "{}")
            };
        } catch (e) {
            console.error(`[GenericToolMapper] Failed to parse arguments for tool ${call.function?.name}:`, e);
            return {
                name: call.function?.name || "unknown",
                args: {}
            };
        }
    });
}

/**
 * Converts Standard Tools to Anthropic Format (Claude 3).
 */
export function convertStandardToolsToAnthropic(standardTools) {
    if (!standardTools || !Array.isArray(standardTools)) return [];

    const anthropicTools = [];
    for (const tool of standardTools) {
        anthropicTools.push({
            name: tool.name,
            description: tool.description,
            input_schema: sanitizeSchema(tool.parameters || { type: "object", properties: {} })
        });
    }
    return anthropicTools;
}

/**
 * Converts Anthropic Tool Use Response to Standard Function Call format.
 * Anthropic Content Array -> Standard Function Calls
 */
export function convertAnthropicToolsToStandard(anthropicContent) {
    if (!anthropicContent || !Array.isArray(anthropicContent)) return [];

    return anthropicContent
        .filter(block => block.type === 'tool_use')
        .map(block => ({
            name: block.name,
            args: block.input || {}
        }));
}
