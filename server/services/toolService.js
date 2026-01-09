import prisma from '../registry.js';
import { registerTools, handleRegisterTool, processApiRegistration } from '../handlers/register.js';
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
        console.log("[ToolService] Fetching all tools...");
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

    async updateResource(type, id, data) {
        try {
            if (type === 'api') {
                // If specUrl or sensitive auth changed, re-validate/generate
                const current = await prisma.verifiedApi.findUnique({ where: { idString: id } });
                if (!current) throw new Error("API not found");

                let updateData = {
                    name: data.name,
                    baseUrl: data.baseUrl,
                    authConfig: data.authConfig,
                    specUrl: data.specUrl // Allow updating Spec URL
                };

                // If specUrl, authConfig, or baseUrl changed, Re-Process
                if (
                    (data.specUrl && data.specUrl !== current.specUrl) ||
                    (data.authConfig && data.authConfig !== current.authConfig) ||
                    (data.baseUrl && data.baseUrl !== current.baseUrl)
                ) {
                    const processed = await processApiRegistration(
                        data.name || current.name,
                        data.specUrl || current.specUrl,
                        data.baseUrl || current.baseUrl,
                        data.authConfig || current.authConfig
                    );
                    updateData = processed;
                    // Preserve ID
                    delete updateData.idString;
                }

                const updated = await prisma.verifiedApi.update({
                    where: { idString: id },
                    data: updateData
                });
                return updated;
            }

            if (type === 'db') {
                // For DB, just generic update, maybe validate connection if string changed
                const updated = await prisma.verifiedDb.update({
                    where: { idString: id },
                    data: {
                        name: data.name,
                        connectionString: data.connectionString,
                        type: data.type
                    }
                });
                return updated;
            }
        } catch (e) {
            console.error("Update failed", e);
            throw e;
        }
    }

    async refreshResource(type, id) {
        if (type === 'api') {
            const current = await prisma.verifiedApi.findUnique({ where: { idString: id } });
            if (!current) throw new Error("API not found");

            // Force Re-Process using existing config
            const processed = await processApiRegistration(current.name, current.specUrl, current.baseUrl, current.authConfig);

            const updated = await prisma.verifiedApi.update({
                where: { idString: id },
                data: {
                    toolConfig: processed.toolConfig,
                    updatedAt: new Date()
                }
            });
            return updated;
        }
        // DB refresh is essentially just validating connection again, or schema introspection if we cached it (we don't cache DB schema currently, meaningful only for APIs)
        return { success: true, message: "DB refresh not required (dynamic)" };
    }

    async getResourceTools(type, id) {
        let tools = [];
        if (type === 'api') {
            const api = await prisma.verifiedApi.findUnique({ where: { idString: id } });
            if (api) {
                tools = await getApiTools(api);
            }
        } else if (type === 'db') {
            const db = await prisma.verifiedDb.findUnique({ where: { idString: id } });
            if (db) {
                tools = getDbTools(db);
            }
        }

        // Strip internal execution details for UI display
        return tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
        }));
    }
}

// Singleton instance
export const toolService = new ToolService();
