#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getApiTools, executeApiTool } from '../handlers/api.js';

/**
 * MCP Server Wrapper para APIs OpenAPI
 * 
 * Uso: node openapi-wrapper.js <apiConfigJson>
 * 
 * apiConfigJson deve conter: { idString, name, baseUrl, specUrl, authConfig }
 */

const apiConfigArg = process.argv[2];
if (!apiConfigArg) {
    console.error("Usage: node openapi-wrapper.js <apiConfigBase64>");
    process.exit(1);
}

let apiConfig;
try {
    // Decode from Base64 (to avoid Windows command line quote issues)
    const configJson = Buffer.from(apiConfigArg, 'base64').toString('utf-8');
    apiConfig = JSON.parse(configJson);
} catch (e) {
    console.error("Failed to parse API config:", e);
    console.error("Received argument:", apiConfigArg);
    process.exit(1);
}

class OpenApiMcpServer {
    constructor(config) {
        this.config = config;
        this.tools = [];

        this.server = new Server(
            {
                name: `openapi-${config.name}`,
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
        this.server.onerror = (error) => console.error("[OpenAPI MCP Error]", error);
    }

    async initialize() {
        console.error(`[OpenAPI MCP] Loading tools for '${this.config.name}'...`);
        try {
            this.tools = await getApiTools(this.config);
            console.error(`[OpenAPI MCP] Loaded ${this.tools.length} tools`);
        } catch (e) {
            console.error(`[OpenAPI MCP] Failed to load tools:`, e);
            // Fallback: Register a "System Error" tool so the Agent knows this API is down
            this.tools = [{
                name: `system_error_${this.config.name}`,
                description: `RESOURCE ERROR: The API '${this.config.name}' failed to load. Use this tool to get error details.`,
                inputSchema: { type: "object", properties: {} },
                _exec: async () => ({
                    content: [{ type: "text", text: `[SYSTEM ERROR] This resource is currently unavailable.\nReason: ${e.message}\nPlease notify the user.` }],
                    isError: true
                })
            }];
        }
    }

    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            // Remove _exec metadata before sending to client
            const cleanTools = this.tools.map(t => {
                const { _exec, ...clean } = t;
                return clean;
            });
            return { tools: cleanTools };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            // Find tool config
            const tool = this.tools.find(t => t.name === name);
            if (!tool) {
                return {
                    content: [{ type: "text", text: `Tool '${name}' not found` }],
                    isError: true
                };
            }

            // Execute using handler logic
            const result = await executeApiTool(tool._exec, args, tool);
            return result;
        });
    }

    async run() {
        await this.initialize();
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`[OpenAPI MCP] Server running for '${this.config.name}'`);
    }
}

const server = new OpenApiMcpServer(apiConfig);
server.run().catch(console.error);
