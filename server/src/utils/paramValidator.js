/**
 * Universal Parameter Validator and Type Coercer
 * Works with ANY API by reading OpenAPI schema and auto-fixing type mismatches
 */

/**
 * Validates and coerces parameters based on OpenAPI schema
 * @param {Object} args - Raw arguments from AI
 * @param {Object} schema - OpenAPI inputSchema (properties + required)
 * @returns {Object} - Validated and type-coerced parameters
 */
export function validateAndCoerceParams(args, schema) {
    if (!schema || !schema.properties) {
        return args; // No schema, pass through
    }

    const coerced = {};
    const errors = [];

    for (const [key, value] of Object.entries(args)) {
        // Skip internal keys
        if (key.startsWith('_')) {
            coerced[key] = value;
            continue;
        }

        const propSchema = schema.properties[key];
        if (!propSchema) {
            // Parameter not in schema - might be hallucinated
            console.warn(`[ParamValidator] Unknown parameter '${key}' not in schema. Skipping.`);
            continue;
        }

        try {
            coerced[key] = coerceValue(value, propSchema, key);
        } catch (e) {
            errors.push(`${key}: ${e.message}`);
        }
    }

    // Check required parameters
    if (schema.required && Array.isArray(schema.required)) {
        for (const requiredKey of schema.required) {
            if (!(requiredKey in coerced) || coerced[requiredKey] === null || coerced[requiredKey] === undefined) {
                errors.push(`${requiredKey}: Required parameter missing`);
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(`Parameter validation failed:\n${errors.join('\n')}`);
    }

    return coerced;
}

/**
 * Coerces a single value to match the expected schema type
 * @param {any} value - Raw value
 * @param {Object} propSchema - Property schema from OpenAPI
 * @param {string} key - Parameter name (for error messages)
 * @returns {any} - Coerced value
 */
function coerceValue(value, propSchema, key) {
    const expectedType = propSchema.type;

    // Handle null/undefined
    if (value === null || value === undefined) {
        if (propSchema.nullable) return null;
        throw new Error(`Cannot be null`);
    }

    // Type coercion logic
    switch (expectedType) {
        case 'string':
            return String(value).trim();

        case 'number':
        case 'integer':
            const num = Number(value);
            if (isNaN(num)) {
                throw new Error(`Expected number, got '${value}'`);
            }
            return expectedType === 'integer' ? Math.floor(num) : num;

        case 'boolean':
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === '1') return true;
                if (lower === 'false' || lower === '0') return false;
            }
            if (typeof value === 'number') return value !== 0;
            throw new Error(`Expected boolean, got '${value}'`);

        case 'array':
            if (Array.isArray(value)) {
                // Coerce array items if schema specifies item type
                if (propSchema.items) {
                    const itemType = propSchema.items.type;

                    // If items are objects or arrays, pass through without coercion
                    if (itemType === 'object' || itemType === 'array') {
                        return value; // Already correct structure
                    }

                    // Otherwise coerce primitive types
                    return value.map((item, idx) => {
                        try {
                            return coerceValue(item, propSchema.items, `${key}[${idx}]`);
                        } catch (e) {
                            console.warn(`[ParamValidator] Array item ${key}[${idx}] coercion failed: ${e.message}. Using raw value.`);
                            return item;
                        }
                    });
                }
                return value;
            }
            // Try to convert single value to array
            console.warn(`[ParamValidator] Converting non-array value to array for '${key}'`);
            return [value];

        case 'object':
            if (typeof value === 'object' && value !== null) return value;
            // Try parsing string as JSON
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    throw new Error(`Expected object, got string that is not valid JSON`);
                }
            }
            throw new Error(`Expected object, got ${typeof value}`);

        default:
            // Unknown type or no type specified - pass through
            return value;
    }
}

/**
 * Generates a helpful error message for the AI to self-correct
 * @param {Error} error - Validation error
 * @param {Object} schema - OpenAPI schema
 * @returns {string} - AI-friendly error message
 */
export function generateAIErrorMessage(error, schema) {
    const message = error.message;

    // Extract parameter name from error
    const paramMatch = message.match(/^([^:]+):/);
    const param = paramMatch ? paramMatch[1] : null;

    let hint = `[PARAMETER ERROR]: ${message}\n\n`;

    if (param && schema.properties && schema.properties[param]) {
        const propSchema = schema.properties[param];
        hint += `Expected format for '${param}':\n`;
        hint += `- Type: ${propSchema.type}\n`;
        if (propSchema.description) {
            hint += `- Description: ${propSchema.description}\n`;
        }
        if (propSchema.type === 'array' && propSchema.items) {
            hint += `- Array items must be: ${propSchema.items.type}\n`;
            hint += `- Example: ["value1", "value2"]\n`;
        }
        if (propSchema.enum) {
            hint += `- Allowed values: ${propSchema.enum.join(', ')}\n`;
        }
    }

    hint += `\nRETRY with corrected parameters.`;
    return hint;
}
