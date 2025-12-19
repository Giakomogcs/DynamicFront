/**
 * Adapter to convert MCP Tools to Gemini Function Declarations
 */
export function mapMcpToolsToGemini(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return [];

    return mcpTools.map(tool => {
        // Gemini expects 'parameters' to be a Schema object (OpenAPI-like)
        // MCP 'inputSchema' is also JSON Schema.
        // We might need minor adjustments, but usually they are compatible.
        // One difference: Gemini likes 'type' to be explicit string (OBJECT, STRING, etc) sometimes in older SDKs,
        // but newer SDK handles JSON schema well.

        // Sanitizing Schema for Gemini (Remove 'default' if problematic, ensure 'type' exists)
        const parameters = { ...tool.inputSchema };
        if (!parameters.type) parameters.type = 'object';

        return {
            name: tool.name,
            description: tool.description,
            parameters: parameters
        };
    });
}

export function mapGeminiCallsToMcp(functionCalls) {
    if (!functionCalls) return [];
    return functionCalls.map(call => ({
        name: call.name,
        args: call.args
    }));
}
