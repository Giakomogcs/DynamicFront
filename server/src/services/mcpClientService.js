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

            // ---------------------------------------------------------
            // DB INTROSPECTION INJECTION
            // ---------------------------------------------------------
            if (serverName.startsWith('db_')) {
                const dbPrefix = serverName; // e.g. db_12345

                // 1. Tool: list_tables
                const listTablesTool = {
                    name: `${dbPrefix}__list_tables`,
                    description: `[Meta] List all tables in this database with row counts. Use this first to explore.`,
                    inputSchema: { type: "object", properties: {}, required: [] },
                    _exec: {
                        type: 'meta_db',
                        action: 'list_tables',
                        serverName: serverName,
                        originalName: 'list_tables' // Virtual
                    }
                };

                // 2. Tool: describe_table
                const describeTableTool = {
                    name: `${dbPrefix}__describe_table`,
                    description: `[Meta] Get schema information (columns, types) and sample data for a specific table.`,
                    inputSchema: {
                        type: "object",
                        properties: {
                            tableName: { type: "string", description: "Name of the table to describe" }
                        },
                        required: ["tableName"]
                    },
                    _exec: {
                        type: 'meta_db',
                        action: 'describe_table',
                        serverName: serverName,
                        originalName: 'describe_table' // Virtual
                    }
                };

                tools.push(listTablesTool);
                tools.push(describeTableTool);
                console.log(`[McpClient] 💉 Injected DB Meta-Tools for '${serverName}'`);
            }

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
        // 1. Check for Virtual Meta Tools first (stored in cache config)
        // However, executeTool receives raw args. We need to know if it's special.
        // The Service caller (ToolService) usually passes the configs.
        // Wait, `executeTool` here is low-level. 
        // But `ToolService` passes `execInfo.config` which we access?
        // No, ToolService calls `mcpClientService.executeTool(execInfo.config.serverName, execInfo.config.originalName, args)`

        // Ensure we handle virtual actions if passed 'originalName' is our virtual one
        // Check if toolName (which is passed as originalName from ToolService) is a virtual action
        if (toolName === 'list_tables' || toolName === 'describe_table') {
            return this.executeMetaDbTool(serverName, toolName, args);
        }

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

    /**
     * Handles virtual DB introspection tools by executing SQL queries on the actual Postgres MCP server.
     */
    async executeMetaDbTool(serverName, action, args) {
        console.log(`[McpClient] 🐢 Executing Meta-DB Action: ${action} on ${serverName}`);

        let sql = "";

        if (action === 'list_tables') {
            // Postgres Table List Query
            sql = `
                SELECT 
                    schemaname || '.' || tablename as "table",
                    (xpath('/row/cnt/text()', xml_count))[1]::text::int as "row_count"
                FROM (
                    SELECT schemaname, tablename, 
                           query_to_xml(format('select count(*) as cnt from %I.%I', schemaname, tablename), false, true, '') as xml_count
                    FROM pg_tables
                    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ) t;
            `;
        } else if (action === 'describe_table') {
            const tableName = args.tableName || "";
            // Safety check: simplistic protection against injection if we interpolate, 
            // but here we should use parameters if the MCP server supports it.
            // The ModelContextProtocol 'query' tool usually takes a single sql string.
            // We will try to rely on the fact that this is an internal tool usage.
            // Postgres "Describe" is effectively querying information_schema

            // 1. Get Columns
            sql = `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = '${tableName}' OR (table_schema || '.' || table_name) = '${tableName}';
             `;

            // 2. Get Sample (We can't do multiple statements easily in one query tool call often, 
            // so we'll just get columns first. Or we can try UNION or just focus on header.)

            // Better: Just select * limit 3 to show data and columns relative.
            if (tableName) {
                return this.executeTool(serverName, 'query', { sql: `SELECT * FROM ${tableName} LIMIT 3` });
            } else {
                return { isError: true, content: [{ type: 'text', text: "Table name required." }] };
            }
        }

        if (sql) {
            // Call the REAL generic 'query' tool (standard in postgres-mcp)
            return this.executeTool(serverName, 'query', { sql });
        }

        return { isError: true, content: [{ type: 'text', text: "Unknown meta action" }] };
    }
}

export { McpClientService };
export const mcpClientService = new McpClientService();
