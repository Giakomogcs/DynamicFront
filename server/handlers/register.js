import prisma from '../registry.js';
import { validateApiSpec } from './api.js';
import { validateDbConnection } from './db.js';
import { generateApiToolsFromDocs } from './api_generator.js';

export const registerTools = [
    {
        name: "register_api",
        description: "Register a new API. Can provide OpenAPI Spec URL OR generic Documentation URL (which will be parsed by AI).",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "A friendly name for the API (e.g. 'Petstore')" },
                specUrl: { type: "string", description: "URL to the OpenAPI JSON/YAML OR Documentation Page" },
                baseUrl: { type: "string", description: "Optional Base URL override" },
                authConfig: { type: "string", description: "JSON string for auth. Supports simple legacy format OR advanced format: { \"docs\": { \"username\": \"...\", \"password\": \"...\" }, \"api\": { \"default\": {...}, \"profiles\": { \"admin\": {...} } } }" }
            },
            required: ["name", "specUrl"]
        }
    },
    {
        name: "register_db",
        description: "Register a new Database.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "A friendly name for the DB" },
                type: { type: "string", description: "Database type (postgres, mysql)", enum: ['postgres', 'mysql'] },
                connectionString: { type: "string", description: "Connection string" }
            },
            required: ["name", "connectionString", "type"]
        }
    }
];

import { testConnection } from './test_connection.js';

export async function processApiRegistration(name, specUrl, baseUrl, authConfigString, docsContent) {
    let toolConfigString = null;
    let authConfig = {};
    try {
        authConfig = JSON.parse(authConfigString || "{}");
        console.log(`[Register] Auth Config Keys: ${Object.keys(authConfig).join(', ')}`);
        if (authConfig.docs) console.log(`[Register] Docs Auth Keys: ${Object.keys(authConfig.docs).join(', ')}`);
    } catch { }

    // Extract docs auth profile if it exists (for 401 Spec URLs)
    const docsAuth = authConfig.docs || null;
    let effectiveBaseUrl = baseUrl;

    try {
        if (!docsContent) {
            // 1. Try Standard OpenAPI Parsing (If no raw docs provided)
            console.log(`[Register] Attempting standard OpenAPI validation for: ${specUrl}`);
            const spec = await validateApiSpec(specUrl, docsAuth);
            console.log(`[Register] OpenAPI validation successful.`);

            // Extract Base URL from spec if not provided
            if (!effectiveBaseUrl) {
                if (spec.servers && spec.servers.length > 0) {
                    effectiveBaseUrl = spec.servers[0].url;
                } else if (spec.host) {
                    const scheme = (spec.schemes && spec.schemes.length > 0) ? spec.schemes[0] : 'https';
                    effectiveBaseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
                }
            }
        } else {
            console.log(`[Register] Raw docs content provided. Skipping URL validation.`);
            throw new Error("Skip to LLM");
        }
    } catch (openApiError) {
        // 2. Fallback: LLM Generation from Docs (or Raw Content)
        console.log(`[Register] OpenAPI validation failed or skipped. Attempting LLM extraction...`);
        try {
            let generatedConfig;
            if (docsContent) {
                // Mock the 'url' arg as 'Raw Text' for the generator
                generatedConfig = await generateApiToolsFromDocs(name, "RAW_TEXT_INPUT", authConfigString || "{}", docsContent);
            } else {
                generatedConfig = await generateApiToolsFromDocs(name, specUrl, authConfigString || "{}");
            }

            // Extract Base URL from generated tools if not provided
            if (!effectiveBaseUrl && generatedConfig.tools && generatedConfig.tools.length > 0) {
                const candidate = generatedConfig.tools.find(t => t.apiConfig && t.apiConfig.baseUrl);
                if (candidate) effectiveBaseUrl = candidate.apiConfig.baseUrl;
            }

            toolConfigString = JSON.stringify(generatedConfig);
            console.log(`[Register] LLM generation successful. Config length: ${toolConfigString.length}`);
        } catch (llmError) {
            console.error(`[Register] LLM generation failed: ${llmError.message}`);
            // If manual base URL is provided, we might still want to save the API even if tool generation fails? 
            // For now, fail hard to ensure quality.
            throw new Error(`Failed to register API. Not a valid OpenAPI spec, and LLM extraction failed: ${llmError.message}`);
        }
    }

    // --- CONNECTION TEST VERIFICATION ---
    if (effectiveBaseUrl) {
        console.log(`[Register] Verifying connection to ${effectiveBaseUrl}...`);
        const testResult = await testConnection(effectiveBaseUrl, authConfig);
        if (!testResult.success) {
            const msg = testResult.results && testResult.results.length > 0
                ? testResult.results.map(r => `${r.profile}: ${r.message}`).join(', ')
                : testResult.message;

            // Allow 404 on root (some APIs don't have root endpoint) if explicitly handled by testConnection (it returns success=true for 404 but message mentions it)
            // But testConnection logic says: if response.ok return success, else return false (except 404 check)
            // Wait, testConnection.js lines 95-96 handles 404 as success=true. So if success=false, it really failed (401, 500, network error).
            throw new Error(`Connection Verification Failed: ${msg}`);
        }
        console.log(`[Register] Connection verified successfully.`);
    } else {
        console.warn(`[Register] Could not determine Base URL. Skipping connection test.`);
    }

    return {
        name,
        specUrl: specUrl || "RAW_TEXT",
        baseUrl: effectiveBaseUrl || baseUrl || "",
        authConfig: authConfigString || "{}",
        toolConfig: toolConfigString
    };
}

export async function handleRegisterTool(name, args) {
    if (name === 'register_api') {
        try {
            const data = await processApiRegistration(args.name, args.specUrl, args.baseUrl, args.authConfig, args.docsContent);

            const newApi = await prisma.verifiedApi.create({ data });
            return {
                content: [{ type: "text", text: `Successfully registered API '${newApi.name}'. ${data.toolConfig ? "Tools were auto-generated from documentation." : "OpenAPI spec detected."}` }]
            };
        } catch (e) {
            return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
        }
    }

    if (name === 'register_db') {
        try {
            // Validate connection
            await validateDbConnection(args.connectionString);

            const newDb = await prisma.verifiedDb.create({
                data: {
                    name: args.name,
                    connectionString: args.connectionString,
                    type: args.type
                }
            });
            return {
                content: [{ type: "text", text: `Successfully registered DB '${newDb.name}' (ID: ${newDb.idString}).` }]
            };
        } catch (e) {
            return { isError: true, content: [{ type: "text", text: `Failed to register DB: ${e.message}` }] };
        }
    }

    throw new Error(`Unknown registration tool: ${name}`);
}
