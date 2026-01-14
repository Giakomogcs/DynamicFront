/**
 * Adapter to convert MCP Tools to Gemini Function Declarations
 */

// Global map to track sanitized names → original names
const toolNameMap = new Map();

/**
 * Sanitize tool name to comply with Gemini's strict naming rules:
 * - Must start with a letter or underscore
 * - Can only contain: a-z, A-Z, 0-9, _, ., :, -
 * - Maximum length: 64 characters
 * 
 * @param {string} name - Original tool name
 * @returns {string} - Sanitized tool name
 */
function sanitizeToolName(name) {
    if (!name) return 'unnamed_tool';

    let sanitized = name;

    // Replace any invalid characters with underscores (Stricter for Gemini: No dashes/dots)
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
 * Fix schema issues for Gemini compatibility
 * - Remove nested 'items.items' which Gemini doesn't support
 * - Ensure all required fields are present
 * - Handle $ref by removing it (Gemini doesn't support references)
 * 
 * @param {object} schema - JSON Schema object
 * @returns {object} - Fixed schema
 */
function fixSchemaForGemini(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    const fixed = { ...schema };

    // Remove JSON Schema metadata fields that Gemini doesn't support
    delete fixed.$schema;
    delete fixed.$id;
    delete fixed.$ref;  // Gemini doesn't support $ref
    delete fixed.$defs;
    delete fixed.definitions;
    delete fixed.$comment;
    // fixed.description and fixed.example are SUPPORTED and USEFUL for Gemini/OpenAI
    delete fixed.minItems;     // Remove validation constraints
    delete fixed.maxItems;
    delete fixed.nullable;     // Gemini doesn't support nullable

    // Handle array types
    if (fixed.type === 'array') {
        // Ensure items exists
        if (!fixed.items) {
            fixed.items = { type: 'string' }; // Default to array of strings
        }

        // Fix tuple validation (array of schemas) -> single schema
        if (Array.isArray(fixed.items)) {
            console.warn(`[GeminiAdapter] Converting tuple items to single schema`);
            fixed.items = fixed.items.length > 0 ? fixed.items[0] : { type: 'string' };
        }

        // Check for double-nested arrays (array of arrays)
        // Keep flattening until we reach a non-array type
        while (fixed.items && typeof fixed.items === 'object' && fixed.items.type === 'array' && fixed.items.items) {
            console.warn(`[GeminiAdapter] Flattening double-nested array`);
            fixed.items = { ...fixed.items.items }; // Clone to avoid mutation issues
        }

        // Remove 'items' from the item schema if it's not an array anymore (residual garbage)
        if (fixed.items && typeof fixed.items === 'object') {
            // Create a shallow copy of items to modify it safely
            fixed.items = { ...fixed.items };

            if (fixed.items.items && fixed.items.type !== 'array') {
                console.warn(`[GeminiAdapter] removing residual 'items' from non-array items schema (type: ${fixed.items.type})`);
                delete fixed.items.items;
            }
        }

        // If items is still an object, process it
        if (fixed.items && typeof fixed.items === 'object') {
            // Remove $ref from items if present (Gemini doesn't support it)
            if (fixed.items.$ref) {
                console.warn(`[GeminiAdapter] Removing $ref from array items: ${fixed.items.$ref}`);
                // Replace with a generic object type
                fixed.items = { type: 'object' };
            }

            // Ensure items has a type field
            if (!fixed.items.type) {
                fixed.items.type = 'object'; // Default to object if missing
            }

            // Recursively fix the items schema
            fixed.items = fixSchemaForGemini(fixed.items);
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
                return [key, fixSchemaForGemini(value)];
            })
        );
    }

    // Recursively fix additionalProperties if it's an object
    if (fixed.additionalProperties && typeof fixed.additionalProperties === 'object') {
        fixed.additionalProperties = fixSchemaForGemini(fixed.additionalProperties);
    }

    // Clean up 'required' field if it references properties that don't exist
    if (fixed.required && Array.isArray(fixed.required) && fixed.properties) {
        fixed.required = fixed.required.filter(req => fixed.properties[req]);
    }

    return fixed;
}

export function mapMcpToolsToGemini(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return [];

    // Clear the map for fresh mapping - DISABLED to prevent concurrency issues with global map
    // toolNameMap.clear();

    return mcpTools.map(tool => {
        // Sanitize tool name for Gemini compatibility
        const sanitizedName = sanitizeToolName(tool.name);

        // Store the mapping: sanitized → original
        toolNameMap.set(sanitizedName, tool.name);

        if (sanitizedName !== tool.name) {
            console.log(`[GeminiAdapter] Sanitized tool name: "${tool.name}" → "${sanitizedName}"`);
        }

        // Fix schema for Gemini compatibility
        let parameters = { ...tool.inputSchema };
        if (!parameters.type) parameters.type = 'object';

        // DEBUG: Log problematic tool schemas
        if (tool.name.includes('searchorderrecommendedcourses')) {
            console.log(`[GeminiAdapter] 🔍 BEFORE fix - ${tool.name}:`, JSON.stringify(parameters, null, 2));
        }

        // Fix nested schema issues
        parameters = fixSchemaForGemini(parameters);

        // DEBUG: Log after fix
        if (tool.name.includes('searchorderrecommendedcourses')) {
            console.log(`[GeminiAdapter] ✅ AFTER fix - ${tool.name}:`, JSON.stringify(parameters, null, 2));
        }

        return {
            name: sanitizedName,
            description: tool.description || 'No description provided',
            parameters: parameters
        };
    });
}

export function mapGeminiCallsToMcp(functionCalls) {
    if (!functionCalls) return [];
    return functionCalls.map(call => {
        // Reverse the mapping: sanitized → original
        const originalName = toolNameMap.get(call.name) || call.name;

        if (originalName !== call.name) {
            console.log(`[GeminiAdapter] Mapped call back: "${call.name}" → "${originalName}"`);
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
