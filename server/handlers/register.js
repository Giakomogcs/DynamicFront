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
                authConfig: { type: "string", description: "JSON string for auth (e.g. {'type': 'bearer', 'token': '...'})" }
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

export async function handleRegisterTool(name, args) {
    if (name === 'register_api') {
        let toolConfigString = null;

        try {
            // 1. Try Standard OpenAPI Parsing
            await validateApiSpec(args.specUrl);
            // If success, we don't necessarily generate toolConfig yet, we let dynamic parser do it?
            // OR we can generate it now to normalize everything.
            // For now, let's keep the old dynamic behavior for valid OpenAPI, 
            // BUT if we want to "freeze" it, we could. 
            // Let's stick to: If OpenAPI valid -> toolConfig is null (use dynamic).

        } catch (openApiError) {
            // 2. Fallback: LLM Generation from Docs
            console.log(`OpenAPI validation failed (${openApiError.message}). Attempting LLM extraction...`);
            try {
                const generatedConfig = await generateApiToolsFromDocs(args.name, args.specUrl, args.authConfig || "{}");
                toolConfigString = JSON.stringify(generatedConfig);
            } catch (llmError) {
                return { isError: true, content: [{ type: "text", text: `Failed to register API. Not a valid OpenAPI spec, and LLM extraction failed: ${llmError.message}` }] };
            }
        }

        try {
            const newApi = await prisma.verifiedApi.create({
                data: {
                    name: args.name,
                    specUrl: args.specUrl,
                    baseUrl: args.baseUrl || "",
                    authConfig: args.authConfig || "{}",
                    toolConfig: toolConfigString
                }
            });
            return {
                content: [{ type: "text", text: `Successfully registered API '${newApi.name}'. ${toolConfigString ? "Tools were auto-generated from documentation." : "OpenAPI spec detected."}` }]
            };
        } catch (e) {
            return { isError: true, content: [{ type: "text", text: `Database Error: ${e.message}` }] };
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
