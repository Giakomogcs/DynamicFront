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

export async function processApiRegistration(name, specUrl, baseUrl, authConfigString) {
    let toolConfigString = null;
    let authConfig = {};
    try { authConfig = JSON.parse(authConfigString || "{}"); } catch { }

    // Extract docs auth profile if it exists (for 401 Spec URLs)
    const docsAuth = authConfig.docs || null;

    try {
        // 1. Try Standard OpenAPI Parsing
        await validateApiSpec(specUrl, docsAuth);
    } catch (openApiError) {
        // 2. Fallback: LLM Generation from Docs
        console.log(`OpenAPI validation failed (${openApiError.message}). Attempting LLM extraction...`);
        try {
            const generatedConfig = await generateApiToolsFromDocs(name, specUrl, authConfigString || "{}");
            toolConfigString = JSON.stringify(generatedConfig);
        } catch (llmError) {
            throw new Error(`Failed to register API. Not a valid OpenAPI spec, and LLM extraction failed: ${llmError.message}`);
        }
    }

    return {
        name,
        specUrl,
        baseUrl: baseUrl || "",
        authConfig: authConfigString || "{}",
        toolConfig: toolConfigString
    };
}

export async function handleRegisterTool(name, args) {
    if (name === 'register_api') {
        try {
            const data = await processApiRegistration(args.name, args.specUrl, args.baseUrl, args.authConfig);

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
