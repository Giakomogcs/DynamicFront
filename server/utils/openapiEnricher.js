/**
 * Enhanced OpenAPI Documentation Analyzer
 * Extracts examples, formats, validation rules, and enriches tool schemas
 */

/**
 * Extracts examples from OpenAPI schema
 */
function extractExamples(schema, spec) {
    const examples = {};

    if (!schema) return examples;

    // Direct example
    if (schema.example !== undefined) {
        return schema.example;
    }

    // Examples array (OpenAPI 3.1)
    if (schema.examples && Array.isArray(schema.examples) && schema.examples.length > 0) {
        return schema.examples[0];
    }

    // Object with examples
    if (schema.examples && typeof schema.examples === 'object') {
        const firstKey = Object.keys(schema.examples)[0];
        if (firstKey) {
            return schema.examples[firstKey].value || schema.examples[firstKey];
        }
    }

    // Generate example from type
    return generateExampleFromType(schema);
}

/**
 * Generates realistic example based on schema type and constraints
 */
function generateExampleFromType(schema) {
    if (!schema || !schema.type) return null;

    switch (schema.type) {
        case 'string':
            if (schema.enum) return schema.enum[0];
            if (schema.format === 'date') return '2024-01-01';
            if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
            if (schema.format === 'email') return 'example@email.com';
            if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
            if (schema.pattern) return 'string'; // Could use regex generator
            if (schema.minLength) return 'a'.repeat(schema.minLength);
            return 'string';

        case 'number':
        case 'integer':
            if (schema.enum) return schema.enum[0];
            if (schema.minimum !== undefined) return schema.minimum;
            if (schema.maximum !== undefined) return schema.maximum;
            return schema.type === 'integer' ? 1 : 1.0;

        case 'boolean':
            return true;

        case 'array':
            const itemExample = schema.items ? generateExampleFromType(schema.items) : 'item';
            return [itemExample];

        case 'object':
            if (!schema.properties) return {};
            const obj = {};
            for (const [key, prop] of Object.entries(schema.properties)) {
                obj[key] = generateExampleFromType(prop);
            }
            return obj;

        default:
            return null;
    }
}

/**
 * Enriches parameter schema with examples, formats, and validation hints
 */
function enrichParameterSchema(param, spec) {
    const enriched = {
        type: param.schema?.type || param.type || 'string',
        description: param.description || ''
    };

    // Add format if present
    if (param.schema?.format || param.format) {
        enriched.format = param.schema?.format || param.format;
    }

    // Add enum if present
    if (param.schema?.enum || param.enum) {
        enriched.enum = param.schema?.enum || param.enum;
    }

    // Add pattern if present
    if (param.schema?.pattern || param.pattern) {
        enriched.pattern = param.schema?.pattern || param.pattern;
    }

    // Add min/max constraints
    if (param.schema?.minimum !== undefined) enriched.minimum = param.schema.minimum;
    if (param.schema?.maximum !== undefined) enriched.maximum = param.schema.maximum;
    if (param.schema?.minLength !== undefined) enriched.minLength = param.schema.minLength;
    if (param.schema?.maxLength !== undefined) enriched.maxLength = param.schema.maxLength;

    // Extract example
    const example = extractExamples(param.schema || param, spec);
    if (example !== null) {
        enriched.example = example;
        // Add example to description for LLM visibility
        enriched.description += enriched.description ? ` (Example: ${JSON.stringify(example)})` : `Example: ${JSON.stringify(example)}`;
    }

    // Add default value
    if (param.schema?.default !== undefined) {
        enriched.default = param.schema.default;
    }

    return enriched;
}

/**
 * Resolves $ref references in OpenAPI spec
 */
function resolveRef(ref, spec) {
    if (!ref || !ref.startsWith('#/')) return null;

    const path = ref.replace('#/', '').split('/');
    let resolved = spec;

    for (const part of path) {
        resolved = resolved?.[part];
        if (!resolved) return null;
    }

    return resolved;
}

/**
 * Enriches request body schema with examples and nested object handling
 */
function enrichBodySchema(requestBody, spec) {
    if (!requestBody?.content?.['application/json']?.schema) {
        return {};
    }

    let schema = requestBody.content['application/json'].schema;

    // Resolve $ref if present
    if (schema.$ref) {
        schema = resolveRef(schema.$ref, spec) || schema;
    }

    const enriched = {};
    const required = schema.required || [];

    if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
            let resolvedProp = prop;

            // Resolve nested $ref
            if (prop.$ref) {
                resolvedProp = resolveRef(prop.$ref, spec) || prop;
            }

            enriched[key] = {
                type: resolvedProp.type || 'string',
                description: resolvedProp.description || ''
            };

            // Add format
            if (resolvedProp.format) {
                enriched[key].format = resolvedProp.format;
            }

            // Add enum
            if (resolvedProp.enum) {
                enriched[key].enum = resolvedProp.enum;
            }

            // Add pattern
            if (resolvedProp.pattern) {
                enriched[key].pattern = resolvedProp.pattern;
            }

            // Add constraints
            if (resolvedProp.minimum !== undefined) enriched[key].minimum = resolvedProp.minimum;
            if (resolvedProp.maximum !== undefined) enriched[key].maximum = resolvedProp.maximum;
            if (resolvedProp.minLength !== undefined) enriched[key].minLength = resolvedProp.minLength;
            if (resolvedProp.maxLength !== undefined) enriched[key].maxLength = resolvedProp.maxLength;

            // Handle arrays
            if (resolvedProp.type === 'array') {
                let items = resolvedProp.items;

                // Resolve items $ref
                if (items?.$ref) {
                    items = resolveRef(items.$ref, spec) || items;
                }

                // 🔥 FIX: Check for Tuple Validation (Array of schemas)
                if (Array.isArray(items)) {
                    // Convert tuple to single schema (union type not supported by all, so take first or merge)
                    // For simplicity, take the first one or default to generic object
                    items = items.length > 0 ? items[0] : { type: 'string' };
                }

                // 🔥 FIX: Flatten double-nested arrays (Gemini doesn't support items.items)
                // Check if items is itself an array type with nested items
                while (items && typeof items === 'object' && items.type === 'array' && items.items) {
                    console.warn(`[OpenAPI Enricher] ⚠️ Flattening double-nested array for property: ${key}`);
                    items = items.items;

                    // Handle nested tuple
                    if (Array.isArray(items)) {
                        items = items.length > 0 ? items[0] : { type: 'string' };
                    }

                    // Resolve nested $ref if present
                    if (items?.$ref) {
                        items = resolveRef(items.$ref, spec) || items;
                    }
                }

                if (items) {
                    const itemsSchema = {
                        type: items.type || 'object'
                    };

                    // If items is object with properties, include structure hint
                    if (items.properties) {
                        itemsSchema.type = 'object';
                        itemsSchema.properties = {};

                        for (const [itemKey, itemProp] of Object.entries(items.properties)) {
                            let resolvedItemProp = itemProp;
                            if (itemProp.$ref) {
                                resolvedItemProp = resolveRef(itemProp.$ref, spec) || itemProp;
                            }

                            itemsSchema.properties[itemKey] = {
                                type: resolvedItemProp.type || 'string',
                                description: resolvedItemProp.description
                            };

                            // Add example for nested property
                            const itemExample = extractExamples(resolvedItemProp, spec);
                            if (itemExample !== null) {
                                itemsSchema.properties[itemKey].example = itemExample;
                            }
                        }

                        // Add required fields for nested object
                        if (items.required) {
                            itemsSchema.required = items.required;
                        }
                    }

                    enriched[key].items = itemsSchema;
                }

                // Add array example
                const arrayExample = extractExamples(resolvedProp, spec);
                if (arrayExample !== null) {
                    enriched[key].example = arrayExample;
                    enriched[key].description += enriched[key].description ? ` (Example: ${JSON.stringify(arrayExample)})` : `Example: ${JSON.stringify(arrayExample)}`;
                } else if (items) {
                    // Generate example array
                    const itemExample = generateExampleFromType(items);
                    if (itemExample !== null) {
                        enriched[key].example = [itemExample];
                        enriched[key].description += enriched[key].description ? ` (Example: ${JSON.stringify([itemExample])})` : `Example: ${JSON.stringify([itemExample])}`;
                    }
                }
            } else {
                // Add example for non-array
                const example = extractExamples(resolvedProp, spec);
                if (example !== null) {
                    enriched[key].example = example;
                    enriched[key].description += enriched[key].description ? ` (Example: ${JSON.stringify(example)})` : `Example: ${JSON.stringify(example)}`;
                }
            }

            // Add default
            if (resolvedProp.default !== undefined) {
                enriched[key].default = resolvedProp.default;
            }

            // Mark as required
            if (required.includes(key)) {
                enriched[key].required = true;
            }
        }
    }

    return enriched;
}

export {
    extractExamples,
    generateExampleFromType,
    enrichParameterSchema,
    enrichBodySchema,
    resolveRef
};
