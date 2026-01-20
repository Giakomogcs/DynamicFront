import prisma from '../registry.js';
import { registerTools, handleRegisterTool, processApiRegistration } from '../handlers/register.js';
import { mcpClientService } from './mcpClientService.js';
import { resourceEnricher } from '../src/core/ResourceEnricher.js';
import { testConnection } from '../handlers/test_connection.js';
import { pageManagerTool, handlePageManager } from '../tools/PageManager.js';

export class ToolService {
    constructor() {
        this.executionMap = new Map();
        this.toolsCache = null;
        this.lastCacheTime = 0;
        this.CACHE_TTL = 1000 * 60 * 5; // 5 minutes
    }

    /**
     * Refreshes and returns all available MCP tools (Static + Registered APIs + Registered DBs)
     * Rebuilds the execution cache.
     * @param {boolean} forceRefresh - Force ignore cache
     */
    async getAllTools(forceRefresh = false) {
        if (!forceRefresh && this.toolsCache && (Date.now() - this.lastCacheTime < this.CACHE_TTL)) {
            // console.log("[ToolService] ⚡ Using cached tools.");
            return this.toolsCache;
        }

        console.log("[ToolService] Fetching all tools...");
        const tools = [];
        this.executionMap.clear();

        // 1. Static Registration Tools
        registerTools.forEach(t => {
            tools.push(t);
            this.executionMap.set(t.name, { type: 'static', handler: handleRegisterTool });
        });

        // 1.1 Page Manager Tool
        tools.push(pageManagerTool);
        this.executionMap.set(pageManagerTool.name, { type: 'static', handler: handlePageManager });

        // 1.5 MCP Client Tools (Filesystem, DBs, APIs - ALL via MCP now)
        try {
            await mcpClientService.initialize();
            const mcpTools = mcpClientService.getAllTools();
            mcpTools.forEach(t => {
                const { _exec, ...clean } = t;
                this.executionMap.set(t.name, { type: 'mcp', config: _exec });
                tools.push(clean);
            });
        } catch (e) {
            console.error("[ToolService] Error fetching MCP Tools:", e);
        }

        // ENRICHMENT STEP
        const enrichment = resourceEnricher.analyzeTools(tools);
        // console.log("[ToolService] Enrichment Summary:\n", enrichment.summary);

        this.toolsCache = tools;
        this.paramsCache = enrichment; // Cache the enrichment result
        this.lastCacheTime = Date.now();
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
            } else if (execInfo.type === 'mcp') {
                return await mcpClientService.executeTool(execInfo.config.serverName, execInfo.config.originalName, args);
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
                // If specUrl, authConfig, or baseUrl changed, Re-Process
                console.log(`[UpdateResource] DEBUG: Checking for changes...`);
                // console.log(`[UpdateResource] New AuthConfig length: ${data.authConfig?.length}`);

                let processedAuthData = data.verificationAuthData || null;
                let finalAuthConfig = data.authConfig || current.authConfig;

                if (
                    (data.specUrl && data.specUrl !== current.specUrl) ||
                    (data.authConfig && data.authConfig !== current.authConfig) ||
                    (data.baseUrl && data.baseUrl !== current.baseUrl)
                ) {
                    console.log(`[UpdateResource] Changes detected. Re-processing registration...`);
                    const processed = await processApiRegistration(
                        data.name || current.name,
                        data.specUrl || current.specUrl,
                        data.baseUrl || current.baseUrl,
                        data.authConfig || current.authConfig,
                        null, // docsContent
                        data.verificationAuthData // Pass client auth data to skip/enrich verification
                    );
                    updateData = processed;
                    // Preserve ID
                    delete updateData.idString;
                    processedAuthData = processed.authData;

                    // Cleanup internal before save
                    delete updateData.authData;
                } else {
                    console.log(`[UpdateResource] No structural changes detected. Verifying Auth consistency...`);
                    // Even if no changes, we verify connection to get the User Data for profile creation
                    if (finalAuthConfig && current.baseUrl && !processedAuthData) {
                        try {
                            const verifyResult = await testConnection(current.baseUrl, finalAuthConfig);

                            // Handle both Flat Return and Array Return from testConnection
                            if (verifyResult.success) {
                                if (verifyResult.results && Array.isArray(verifyResult.results)) {
                                    const firstSuccess = verifyResult.results.find(r => r.success && r.authData);
                                    if (firstSuccess) {
                                        processedAuthData = firstSuccess.authData;
                                        console.log(`[UpdateResource] Verification successful (Array). Captured Auth Data:`, JSON.stringify(processedAuthData).substring(0, 100));
                                    }
                                } else if (verifyResult.authData) {
                                    // Flat return case
                                    processedAuthData = verifyResult.authData;
                                    console.log(`[UpdateResource] Verification successful (Flat). Captured Auth Data:`, JSON.stringify(processedAuthData).substring(0, 100));
                                } else {
                                    console.log(`[UpdateResource] Verification successful but NO AuthData found.`);
                                }
                            }
                        } catch (verifyErr) {
                            console.warn("[UpdateResource] Background verification failed:", verifyErr);
                        }
                    }
                }

                // --- AUTO CREATE AUTH PROFILE ON UPDATE (ALWAYS CHECK) ---
                if (finalAuthConfig) {
                    try {
                        const parsed = JSON.parse(finalAuthConfig);
                        const auth = parsed.api?.default || parsed;
                        let hasCreds = false;
                        let label = "Updated User";
                        let role = "user";

                        console.log(`[UpdateResource] Auto-checking profile creation. Auth Type: ${auth.type}`);

                        // Try to extract from Auth Config
                        if (auth.username || auth.email) {
                            hasCreds = true;
                            label = auth.username || auth.email;
                        } else if (auth.loginParams && auth.loginParams.some(p => p.value)) {
                            hasCreds = true;
                            const emailParam = auth.loginParams.find(p => p.key.includes('email') || p.key.includes('user'));
                            if (emailParam) label = emailParam.value;
                            console.log(`[UpdateResource] Found Login Param Value: ${label}`);
                        } else if (auth.token && auth.type === 'bearer') {
                            hasCreds = true;
                            label = "Bearer User";
                        }

                        // Enrich with AuthData from verification
                        if (processedAuthData) {
                            const ad = processedAuthData;
                            if (ad.role || ad.type || (ad.user && ad.user.role)) {
                                role = ad.role || ad.type || ad.user.role;
                            }
                            if (ad.name || ad.username || (ad.user && ad.user.name)) {
                                label = ad.name || ad.username || ad.user.name;
                                if (role !== 'user') label += ` (${role})`;
                            }
                            // If we have strong auth data, enable saving even if config params seemed empty
                            if (ad.id || ad.email || ad.name) hasCreds = true;
                        }

                        console.log(`[UpdateResource] HasCreds: ${hasCreds}, Label: ${label}`);

                        if (hasCreds) {
                            // Check if profile already exists for this Label to avoid dupes?
                            const existingProfiles = resourceEnricher.getProfiles(id);
                            const isDuplicate = existingProfiles.some(p => p.label === label);

                            if (!isDuplicate) {
                                console.log(`[Update] Auto-creating auth profile for ${current.name} (ID: ${id})...`);

                                // SANITIZE CREDENTIALS
                                let cleanCredentials = {};
                                if (auth.type === 'basic') {
                                    if (auth.loginParams && Array.isArray(auth.loginParams)) {
                                        auth.loginParams.forEach(p => {
                                            if (p.key && p.value) cleanCredentials[p.key] = p.value;
                                        });
                                    }
                                } else if (auth.type === 'bearer') {
                                    cleanCredentials.token = auth.token;
                                } else if (auth.type === 'apiKey') {
                                    cleanCredentials.apiKey = auth.apiKey?.value || auth.value;
                                    cleanCredentials.paramName = auth.apiKey?.paramName || auth.paramName;
                                } else {
                                    if (auth.username) cleanCredentials.username = auth.username;
                                    if (auth.password) cleanCredentials.password = auth.password;
                                    if (Object.keys(cleanCredentials).length === 0) cleanCredentials = auth;
                                }

                                // Add enriched data
                                if (auth.cnpj) cleanCredentials.cnpj = auth.cnpj;
                                if (auth.companyId) cleanCredentials.companyId = auth.companyId;

                                await resourceEnricher.addProfile(id, {
                                    label,
                                    role,
                                    credentials: cleanCredentials
                                });
                            } else {
                                console.log(`[Update] Profile '${label}' already exists. Skipping auto-creation.`);
                            }
                        }
                    } catch (profileErr) {
                        console.warn("[Update] Failed to auto-create profile (non-fatal):", profileErr);
                    }
                }

                const updated = await prisma.verifiedApi.update({
                    where: { idString: id },
                    data: updateData
                });

                // Refresh MCP Server for this API
                if (data.specUrl || data.baseUrl || data.authConfig) {
                    // We need to re-spawn the server with new config
                    try {
                        const { mcpClientService } = await import('./mcpClientService.js');
                        await mcpClientService.spawnApiServer(updated);
                        // Force tool cache refresh
                        const toolService = (await import('./toolService.js')).toolService;
                        await toolService.getAllTools(true);
                    } catch (e) {
                        console.error("[UpdateResource] Failed to reload MCP server:", e);
                    }
                }

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
        // ... (existing implementation)
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

    /**
     * Returns the enriched summary of capabilities
     */
    async getResourceProfiles() {
        if (!this.toolsCache) {
            await this.getAllTools();
        }
        return this.paramsCache?.summary || "Analyzing resources...";
    }
}

// Singleton instance
export const toolService = new ToolService();
