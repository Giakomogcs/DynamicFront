/**
 * Adapter to convert MCP Tools to Schema-Compliant Function Declarations
 * (Works for Gemini, OpenAI, Copilot, etc.)
 */

// Global map to track sanitized names → original names
const toolNameMap = new Map();

/**
 * Sanitize tool name to comply with strict naming rules common across providers:
 * - Must start with a letter or underscore
 * - Can only contain: a-z, A-Z, 0-9, _, - (some providers dislike dashes, but mostly ok)
 * - Maximum length: 64 characters
 * 
 * @param {string} name - Original tool name
 * @returns {string} - Sanitized tool name
 */
function sanitizeToolName(name) {
    if (!name) return 'unnamed_tool';

    let sanitized = name;

    // STRATEGY: Strip UUID Prefix if present (commonly formatted as "api_UUID__toolname")
    if (sanitized.includes('__')) {
        const parts = sanitized.split('__');
        // Take the last part (the actual tool name)
        // Example: "api_5d19...__dn_usercontroller_list" -> "dn_usercontroller_list"
        if (parts.length > 1) {
            sanitized = parts[parts.length - 1];
        }
    }

    // Replace any invalid characters with underscores
    // Valid chars: a-z, A-Z, 0-9, _
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure it starts with a letter or underscore
    if (!/^[a-zA-Z_]/.test(sanitized)) {
        sanitized = 'tool_' + sanitized;
    }

    // Truncate to 64 characters max
    if (sanitized.length > 64) {
        // Keep the end part which usually has the meaningful name
        sanitized = sanitized.substring(sanitized.length - 64);

        // Re-check if it still starts with valid char after truncation
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = 'tool_' + sanitized.substring(5); // Remove first 5 chars and add prefix
        }
    }

    return sanitized;
}

/**
 * Fix schema issues for Provider compatibility (Gemini/OpenAI)
 * - Remove nested 'items.items' which some providers fail on
 * - Ensure all required fields are present
 * - Handle $ref by removing it (Not supported in function calling schemas)
 * 
 * @param {object} schema - JSON Schema object
 * @returns {object} - Fixed schema
 */
/**
 * Fix schema issues for Provider compatibility (Gemini/OpenAI/Copilot)
 * - Recursively flattens nested arrays (Array<Array<T>> -> Array<T>)
 * - Relaxes strict types (boolean/null -> string) in complex objects
 * - Removes validation noise (minItems, uniqueItems)
 * 
 * @param {object} schema - JSON Schema object
 * @returns {object} - Fixed schema
 */
function fixSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const fixed = { ...schema };

    // 1. Remove unsupported metadata
    const unsupportedKeys = [
        '$schema', '$id', '$ref', '$defs', 'definitions', '$comment',
        'minItems', 'maxItems', 'uniqueItems', 'nullable', 'readOnly', 'writeOnly'
    ];
    unsupportedKeys.forEach(key => delete fixed[key]);

    // 2. Fix 'required' if it's a boolean (Legacy OpenAPI artifact)
    // The 'required' keyword in JSON Schema must be an array of strings. 
    // Boolean 'required: true' in sub-properties causes validation errors ("True is not of type array").
    // 2. Fix 'required' if it's a boolean (Legacy OpenAPI artifact)
    // The 'required' keyword in JSON Schema must be an array of strings.
    // Boolean 'required: true' in sub-properties causes validation errors ("True is not of type array").
    if (fixed.required !== undefined && !Array.isArray(fixed.required)) {
        if (fixed.required === true) { 
             // console.log('[ToolAdapter] Removing "required: true" from schema property'); 
        }
        delete fixed.required;
    }

    // 3. Handle Arrays (The most common issue: Nested Arrays)
    if (fixed.type === 'array') {
        // Ensure 'items' exists
        if (!fixed.items) {
            fixed.items = { type: 'string' };
        }

        // Fix Tuple validation (Array of schemas) -> Single schema
        if (Array.isArray(fixed.items)) {
            fixed.items = fixed.items.length > 0 ? fixed.items[0] : { type: 'string' };
        }

        // FLATTENING STRATEGY:
        // If items is ALSO an array, peel one layer off.
        // e.g., Array<Array<Object>> -> Array<Object>
        // Many LLMs fail to generate double-nested arrays correctly.
        while (fixed.items && fixed.items.type === 'array' && fixed.items.items) {
            console.warn(`[ToolAdapter] Flattening nested array layer`);
            fixed.items = { ...fixed.items.items };
        }

        // Recursively fix the items
        fixed.items = fixSchema(fixed.items);
    }

    // 3. Handle Objects
    if (fixed.type === 'object' || fixed.properties) {
        // Ensure type is explicit
        fixed.type = 'object';

        if (fixed.properties) {
            fixed.properties = Object.fromEntries(
                Object.entries(fixed.properties).map(([key, value]) => {
                    return [key, fixSchema(value)];
                })
            );
        }

        // Fix additionalProperties
        if (fixed.additionalProperties && typeof fixed.additionalProperties === 'object') {
            fixed.additionalProperties = fixSchema(fixed.additionalProperties);
        }

        // Clean required fields
        if (fixed.required && Array.isArray(fixed.required) && fixed.properties) {
             fixed.required = fixed.required.filter(req => fixed.properties[req]);
        }
    }

    // 4. Type Relaxation (Generic Safety)
    // Some complex types (boolean, null) in parameters confuse models or cause validation errors
    // if the model hallucinates a string. 
    // We convert sensitive strict types to string in complex contexts unless it's a simple primitive.
    // (Skipping for now to avoid over-engineering, but keeping note)

    return fixed;
}

export function mapMcpToolsToAiModels(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return [];

    // Clear the map for fresh mapping - DISABLED to prevent concurrency issues with global map
    // toolNameMap.clear();

    return mcpTools.map(tool => {
        // Sanitize tool name for compatibility
        const sanitizedName = sanitizeToolName(tool.name);

        // Store the mapping: sanitized → original
        toolNameMap.set(sanitizedName, tool.name);

        if (sanitizedName !== tool.name) {
            console.log(`[ToolAdapter] Sanitized tool name: "${tool.name}" → "${sanitizedName}"`);
        }

        // Fix schema for compatibility
        let parameters = { ...tool.inputSchema };
        if (!parameters.type) parameters.type = 'object';

        // DEBUG: Log problematic tool schemas
        if (tool.name.includes('searchorderrecommendedcourses')) {
            console.log(`[ToolAdapter] 🔍 BEFORE fix - ${tool.name}:`, JSON.stringify(parameters, null, 2));
        }

        // Fix nested schema issues
        parameters = fixSchema(parameters);

        // DEBUG: Log after fix
        if (tool.name.includes('searchorderrecommendedcourses')) {
            console.log(`[ToolAdapter] ✅ AFTER fix - ${tool.name}:`, JSON.stringify(parameters, null, 2));
        }

        return {
            name: sanitizedName,
            description: tool.description || 'No description provided',
            parameters: parameters
        };
    });
}

export function mapAiModelCallsToMcp(functionCalls) {
    if (!functionCalls) return [];
    return functionCalls.map(call => {
        // Reverse the mapping: sanitized → original
        const originalName = toolNameMap.get(call.name) || call.name;

        if (originalName !== call.name) {
            console.log(`[ToolAdapter] Mapped call back: "${call.name}" → "${originalName}"`);
        }

        return {
            name: originalName,
            args: call.args
        };
    });
}

/**
 * Get the original tool name from a sanitized name
 * @param {string} sanitizedName - Sanitized tool name
 * @returns {string} - Original tool name
 */
export function getOriginalToolName(sanitizedName) {
    return toolNameMap.get(sanitizedName) || sanitizedName;
}
