import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCP_SERVERS } from "../config/mcp_config.js";
import prisma from "../registry.js";
import path from 'path';

class McpClientService {
    constructor() {
        this.clients = new Map(); // serverName -> Client instance
        this.toolsCache = new Map(); // serverName -> [tools]
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        console.log("[McpClient] Initializing connections to MCP Servers...");

        // 1. Static Servers (filesystem, etc.)
        for (const [name, config] of Object.entries(MCP_SERVERS)) {
            try {
                await this.connectToServer(name, config);
            } catch (e) {
                console.error(`[McpClient] Failed to connect to ${name}:`, e);
            }
        }

        // 2. Dynamic DB Servers (only enabled)
        try {
            const dbs = await prisma.verifiedDb.findMany({
                where: { isEnabled: true }
            });
            for (const db of dbs) {
                await this.spawnDbServer(db);
            }
        } catch (e) {
            console.error("[McpClient] Error spawning DB servers:", e);
        }

        // 3. Dynamic API Servers (only enabled)
        try {
            const apis = await prisma.verifiedApi.findMany({
                where: { isEnabled: true }
            });
            for (const api of apis) {
                await this.spawnApiServer(api);
            }
        } catch (e) {
            console.error("[McpClient] Error spawning API servers:", e);
        }

        this.isInitialized = true;
    }

    async spawnDbServer(dbConfig) {
        const serverName = `db_${dbConfig.idString}`;
        console.log(`[McpClient] Spawning DB server '${serverName}' (${dbConfig.type})...`);

        let command, args;
        if (dbConfig.type === 'postgres') {
            command = "npx";
            args = ["-y", "@modelcontextprotocol/server-postgres", dbConfig.connectionString];
        } else {
            console.warn(`[McpClient] Unsupported DB type: ${dbConfig.type}`);
            return;
        }

        try {
            await this.connectToServer(serverName, { command, args });
        } catch (e) {
            console.error(`[McpClient] Failed to spawn DB server '${serverName}':`, e);
        }
    }

    async spawnApiServer(apiConfig) {
        const serverName = `api_${apiConfig.idString}`;
        console.log(`[McpClient] Spawning API server '${serverName}'...`);

        // Check if already running and kill/close it
        if (this.clients.has(serverName)) {
            console.log(`[McpClient] Server '${serverName}' already running. Closing before respawn...`);
            try {
                const client = this.clients.get(serverName);
                await client.close();
                // Note: client.close() might not kill the spawned process if transport doesn't handle it. 
                // StdioClientTransport usually kills the child process.
                this.clients.delete(serverName);
                this.toolsCache.delete(serverName);
            } catch (e) {
                console.warn(`[McpClient] Warning closing '${serverName}':`, e);
            }
        }

        const wrapperPath = path.resolve("./src/mcp-servers/openapi-wrapper.js");

        // Use Base64 to avoid Windows command line quote escaping issues
        const configJson = JSON.stringify(apiConfig);
        const configBase64 = Buffer.from(configJson).toString('base64');

        const config = {
            command: "node",
            args: [wrapperPath, configBase64]
        };

        try {
            await this.connectToServer(serverName, config);
        } catch (e) {
            console.error(`[McpClient] Failed to spawn API server '${serverName}':`, e);
        }
    }

    async reload() {
        console.log("[McpClient] Reloading all servers...");
        await this.syncWithRegistry();
    }

    /**
     * Synchronizes running MCP servers with the database registry.
     * Spawns new servers and stops removed ones.
     */
    async syncWithRegistry() {
        console.log("[McpClient] Syncing Registry...");

        // Fetch current desired state
        const dbs = await prisma.verifiedDb.findMany({ where: { isEnabled: true } });
        const apis = await prisma.verifiedApi.findMany({ where: { isEnabled: true } });

        const activeServerNames = new Set(this.clients.keys());
        const desiredServerNames = new Set([
            ...Object.keys(MCP_SERVERS),
            ...dbs.map(db => `db_${db.idString}`),
            ...apis.map(api => `api_${api.idString}`)
        ]);

        // 1. STOP removed servers
        for (const name of activeServerNames) {
            if (!desiredServerNames.has(name)) {
                console.log(`[McpClient] Stopping removed server: ${name}`);
                try {
                    const client = this.clients.get(name);
                    await client.close();
                    this.clients.delete(name);
                    this.toolsCache.delete(name);
                } catch (e) {
                    console.error(`[McpClient] Error stopping ${name}:`, e);
                }
            }
        }

        // 2. START new servers
        for (const db of dbs) {
            const name = `db_${db.idString}`;
            if (!this.clients.has(name)) {
                await this.spawnDbServer(db);
            }
        }
        for (const api of apis) {
            const name = `api_${api.idString}`;
            if (!this.clients.has(name)) {
                await this.spawnApiServer(api);
            }
        }

        console.log("[McpClient] Sync Complete.");
    }

    async connectToServer(name, config) {
        console.log(`[McpClient] Connecting to '${name}' via Stdio...`);

        const transport = new StdioClientTransport({
            command: config.command,
            args: config.args,
            env: { ...process.env, ...config.env } // Pass env vars if needed
        });

        const client = new Client(
            {
                name: "dynamic-front-client",
                version: "1.0.0",
            },
            {
                capabilities: {
                    sampling: {},
                },
            }
        );

        await client.connect(transport);
        console.log(`[McpClient] Connected to '${name}'`);

        this.clients.set(name, client);

        // Pre-fetch tools
        await this.refreshTools(name);
    }

    async refreshTools(serverName) {
        const client = this.clients.get(serverName);
        if (!client) return;

        try {
            const result = await client.listTools();
            const tools = result.tools.map(t => {
                const fullName = `${serverName}__${t.name}`;

                // OpenAI/Copilot limit is 64 characters
                let toolName = fullName;
                if (fullName.length > 64) {
                    // Strategy: Shorten the prefix. 
                    // UUIDs are roughly 36 chars. api_ + 36 + __ = ~41 chars.
                    // If we use only the first 8 chars of the ID: api_8chars + __ = 12 chars.
                    const serverPrefix = serverName.startsWith('api_') || serverName.startsWith('db_')
                        ? serverName.split('_')[0] + '_' + serverName.split('_')[1].substring(0, 8)
                        : serverName.substring(0, 12);

                    toolName = `${serverPrefix}__${t.name}`;

                    // If still too long, truncate tool name
                    if (toolName.length > 64) {
                        const overflow = toolName.length - 64;
                        toolName = `${serverPrefix}__${t.name.substring(0, t.name.length - overflow)}`;
                    }
                    console.log(`[McpClient] ⚠️ Shortened tool name: '${fullName}' -> '${toolName}'`);
                }

                return {
                    ...t,
                    name: toolName,
                    _exec: {
                        type: 'mcp',
                        serverName: serverName,
                        originalName: t.name
                    }
                };
            });

            this.toolsCache.set(serverName, tools);
            console.log(`[McpClient] Loaded ${tools.length} tools from '${serverName}'`);
        } catch (e) {
            console.error(`[McpClient] Error fetching tools from '${serverName}':`, e);
            this.toolsCache.set(serverName, []);
        }
    }

    getAllTools() {
        // Return a flat list of all tools from all servers
        let allTools = [];
        for (const tools of this.toolsCache.values()) {
            allTools = allTools.concat(tools);
        }
        return allTools;
    }

    async executeTool(serverName, toolName, args) {
        const client = this.clients.get(serverName);
        if (!client) throw new Error(`MCP Server '${serverName}' not connected.`);

        // SDK execute flow
        const result = await client.callTool({
            name: toolName,
            arguments: args
        });

        // Normalize result to our App's format: { content: [{ type: 'text', text: ... }] }
        // MCP SDK result structure: { content: [ { type: 'text', text: '...' }, ... ], isError: boolean }
        return result;
    }
}

export { McpClientService };
export const mcpClientService = new McpClientService();
