import prisma from '../registry.js';
import { registerTools, handleRegisterTool } from '../handlers/register.js';
import { getApiTools, executeApiTool } from '../handlers/api.js';
import { getDbTools, executeDbTool } from '../handlers/db.js';

export class ToolService {
    constructor() {
        this.executionMap = new Map();
    }

    /**
     * Refreshes and returns all available MCP tools (Static + Registered APIs + Registered DBs)
     * Rebuilds the execution cache.
     */
    async getAllTools() {
        const tools = [];
        this.executionMap.clear();

        // 1. Static Registration Tools
        registerTools.forEach(t => {
            tools.push(t);
            this.executionMap.set(t.name, { type: 'static', handler: handleRegisterTool });
        });

        // 2. Dynamic API Tools
        try {
            const apis = await prisma.verifiedApi.findMany();
            for (const api of apis) {
                const apiTools = await getApiTools(api);
                apiTools.forEach(t => {
                    const { _exec, ...clean } = t;
                    // _exec contains { type: 'api', apiId, ... }
                    this.executionMap.set(t.name, { type: 'api', config: _exec });
                    tools.push(clean);
                });
            }
        } catch (e) {
            console.error("[ToolService] Error fetching APIs:", e.message);
        }

        // 3. Dynamic DB Tools
        try {
            const dbs = await prisma.verifiedDb.findMany();
            for (const db of dbs) {
                const dbTools = getDbTools(db);
                dbTools.forEach(t => {
                    const { _exec, ...clean } = t;
                    // _exec contains { type: 'db', connectionString, ... }
                    this.executionMap.set(t.name, { type: 'db', config: _exec });
                    tools.push(clean);
                });
            }
        } catch (e) {
            console.error("[ToolService] Error fetching DBs (Check connection):", e.message);
        }

        return tools;
    }

    /**
     * Executes a tool by name with arguments.
     * Uses the internal cache populated by getAllTools().
     */
    async executeTool(name, args) {
        const execInfo = this.executionMap.get(name);

        if (!execInfo) {
            // Attempt a lazy refresh if not found (optional safety net)
            // await this.getAllTools();
            // execInfo = this.executionMap.get(name);
            // if (!execInfo) 
            return { isError: true, content: [{ type: "text", text: `Tool '${name}' not found.` }] };
        }

        try {
            if (execInfo.type === 'static') {
                return await execInfo.handler(name, args);
            } else if (execInfo.type === 'api') {
                return await executeApiTool(execInfo.config, args);
            } else if (execInfo.type === 'db') {
                return await executeDbTool(execInfo.config, args);
            }
        } catch (error) {
            return { isError: true, content: [{ type: "text", text: `Execution Error: ${error.message}` }] };
        }

        return { isError: true, content: [{ type: "text", text: "Unknown tool type" }] };
    }

    /**
     * Returns raw list of registered resources for UI management
     */
    async getRegisteredResources() {
        try {
            const apis = await prisma.verifiedApi.findMany();
            const dbs = await prisma.verifiedDb.findMany();
            return { apis, dbs };
        } catch (e) {
            console.error("Error fetching resources:", e);
            return { apis: [], dbs: [] };
        }
    }

    async deleteResource(type, id) {
        try {
            if (type === 'api') await prisma.verifiedApi.delete({ where: { idString: id } });
            if (type === 'db') await prisma.verifiedDb.delete({ where: { idString: id } });
            return true;
        } catch (e) {
            console.error("Delete failed", e);
            return false;
        }
    }
}

// Singleton instance
export const toolService = new ToolService();
