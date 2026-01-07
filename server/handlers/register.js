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

export async function processApiRegistration(name, specUrl, baseUrl, authConfigString, docsContent) {
    let toolConfigString = null;
    let authConfig = {};
    try { authConfig = JSON.parse(authConfigString || "{}"); } catch { }

    // Extract docs auth profile if it exists (for 401 Spec URLs)
    const docsAuth = authConfig.docs || null;

    try {
        if (!docsContent) {
            // 1. Try Standard OpenAPI Parsing (If no raw docs provided)
            console.log(`[Register] Attempting standard OpenAPI validation for: ${specUrl}`);
            await validateApiSpec(specUrl, docsAuth);
            console.log(`[Register] OpenAPI validation successful.`);
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

            toolConfigString = JSON.stringify(generatedConfig);
            console.log(`[Register] LLM generation successful. Config length: ${toolConfigString.length}`);
        } catch (llmError) {
            console.error(`[Register] LLM generation failed: ${llmError.message}`);
            // If manual base URL is provided, we might still want to save the API even if tool generation fails? 
            // For now, fail hard to ensure quality.
            throw new Error(`Failed to register API. Not a valid OpenAPI spec, and LLM extraction failed: ${llmError.message}`);
        }
    }

    return {
        name,
        specUrl: specUrl || "RAW_TEXT",
        baseUrl: baseUrl || "",
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
