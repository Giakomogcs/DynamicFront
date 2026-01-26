/**
 * Adapter to map internal MCP Tool definitions to AI Model compatible formats.
 * Primarily converts 'inputSchema' to 'parameters' and sanitizes names if needed.
 */
const sanitizedToOriginalMap = new Map();

export function mapMcpToolsToAiModels(mcpTools) {
    if (!Array.isArray(mcpTools)) return [];

    return mcpTools.map(tool => {
        // Ensure we have a valid object
        if (!tool) return null;

        // Sanitize name: replace non-alphanumeric chars (except _ and -) with _
        // Gemini/OpenAI typically accept ^[a-zA-Z0-9_-]+$
        const sanitizedName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Store mapping
        sanitizedToOriginalMap.set(sanitizedName, tool.name);

        return {
            name: sanitizedName,
            description: tool.description || 'No description provided',
            // Map inputSchema (MCP standard) to parameters (OpenAI/Gemini standard)
            parameters: tool.inputSchema || tool.parameters || { type: 'object', properties: {} }
        };
    }).filter(t => t !== null);
}

export function getOriginalToolName(sanitizedName) {
    return sanitizedToOriginalMap.get(sanitizedName) || sanitizedName;
}
