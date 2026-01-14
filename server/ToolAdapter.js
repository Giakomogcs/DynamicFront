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
function fixSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const fixed = { ...schema };

    // Remove JSON Schema metadata fields not supported in tool definitions
    delete fixed.$schema;
    delete fixed.$id;
    delete fixed.$ref;
    delete fixed.$defs;
    delete fixed.definitions;
    delete fixed.$comment;
    
    // Valid fields: description, example, type, properties, required, items, enum
    
    delete fixed.minItems;     // Remove validation constraints
    delete fixed.maxItems;
    delete fixed.nullable;     // Not strictly supported in all OpenAI-likes

    // Handle array types
    if (fixed.type === 'array') {
        // Ensure items exists
        if (!fixed.items) {
            fixed.items = { type: 'string' }; // Default to array of strings
        }

        // Fix tuple validation (array of schemas) -> single schema
        if (Array.isArray(fixed.items)) {
            console.warn(`[ToolAdapter] Converting tuple items to single schema`);
            fixed.items = fixed.items.length > 0 ? fixed.items[0] : { type: 'string' };
        }

        // Check for double-nested arrays (array of arrays)
        // Keep flattening until we reach a non-array type
        while (fixed.items && typeof fixed.items === 'object' && fixed.items.type === 'array' && fixed.items.items) {
            console.warn(`[ToolAdapter] Flattening double-nested array`);
            fixed.items = { ...fixed.items.items }; // Clone to avoid mutation issues
        }

        // Remove 'items' from the item schema if it's not an array anymore (residual garbage)
        if (fixed.items && typeof fixed.items === 'object') {
            // Create a shallow copy of items to modify it safely
            fixed.items = { ...fixed.items };

            if (fixed.items.items && fixed.items.type !== 'array') {
                console.warn(`[ToolAdapter] removing residual 'items' from non-array items schema (type: ${fixed.items.type})`);
                delete fixed.items.items;
            }
        }

        // If items is still an object, process it
        if (fixed.items && typeof fixed.items === 'object') {
            // Remove $ref from items if present
            if (fixed.items.$ref) {
                console.warn(`[ToolAdapter] Removing $ref from array items: ${fixed.items.$ref}`);
                // Replace with a generic object type
                fixed.items = { type: 'object' };
            }

            // Ensure items has a type field
            if (!fixed.items.type) {
                fixed.items.type = 'object'; // Default to object if missing
            }

            // Recursively fix the items schema
            fixed.items = fixSchema(fixed.items);
        }
    }

    // Ensure type is always present for objects
    if (!fixed.type && fixed.properties) {
        fixed.type = 'object';
    }

    // Recursively fix properties
    if (fixed.properties) {
        fixed.properties = Object.fromEntries(
            Object.entries(fixed.properties).map(([key, value]) => {
                return [key, fixSchema(value)];
            })
        );
    }

    // Recursively fix additionalProperties if it's an object
    if (fixed.additionalProperties && typeof fixed.additionalProperties === 'object') {
        fixed.additionalProperties = fixSchema(fixed.additionalProperties);
    }

    // Clean up 'required' field if it references properties that don't exist
    if (fixed.required && Array.isArray(fixed.required) && fixed.properties) {
        fixed.required = fixed.required.filter(req => fixed.properties[req]);
    }

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
