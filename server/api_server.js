// Configure UTF-8 encoding FIRST
import './src/utils/utf8-config.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from './registry.js';
import dotenv from 'dotenv';
dotenv.config();

// Import our MCP Logic
import { toolService } from './services/toolService.js';
import { storageService } from './services/storageService.js';
import { orchestrator } from './agents/Orchestrator.js';

// Import routes
// Import routes
import sessionRoutes from './routes/sessionRoutes.js';
import widgetRoutes from './routes/widgetRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure UTF-8 for all responses
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/widgets', widgetRoutes);

// Test Routes (Phase 1 Dev Only)
import testRoutes from './routes/testRoutes.js';
app.use('/api/test', testRoutes);

// Initialize Gemini
import { modelManager } from './services/ai/ModelManager.js';

// --- Endpoints ---


// 1.5 Chat Endpoint (Models)
app.get('/api/models', async (req, res) => {
    try {
        const models = await modelManager.getAvailableModels();
        // Return both list and the currently configured default (from .env or server fallback)
        res.json({
            models,
            defaultModel: "gemini-2.0-flash" // Safe fallback if frontend needs one, or use first model
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 1. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, location, model, canvasContext } = req.body;
        console.log(`[API Server] Received chat request: "${message?.substring(0, 50)}..."`);
        if (canvasContext) {
            console.log(`[API Server] Canvas Context: mode=${canvasContext.mode}, widgets=${canvasContext.widgets?.length || 0}`);
        }

        // Delegate entire process to the Multi-Agent Orchestrator
        const result = await orchestrator.processRequest(message, history, model, location, canvasContext);

        res.json(result);

    } catch (error) {
        console.error("Chat Error:", error);

        let userMessage = "I am experiencing heavy traffic or an internal error occurred.";

        // Clearer feedback for Quota/Rate Limits
        if (error.message.includes('429') || error.message.includes('Quota') || error.message.includes('Too Many Requests')) {
            userMessage = `⚠️ **Quota Exceeded** for the selected model (${model || 'Default'}).\n\nPlease try:\n1. Switching to a different model (e.g., 'gemini-2.0-flash') using the selector in the header.\n2. Waiting a few minutes.`;
        }

        res.status(500).json({
            text: userMessage,
            error: error.message
        });
    }
});

// 2. Direct Tool Execution (for Registration Modals)
app.post('/api/tools/execute', async (req, res) => {
    const { name, args } = req.body;
    try {
        if (name.startsWith('register_')) {
            // Force refresh of tools to ensure registry is loaded if this is fresh
            await toolService.getAllTools();
            const result = await toolService.executeTool(name, args);
            if (result.isError) return res.status(400).json({ error: result.content[0].text });
            return res.json(result);
        }
        res.status(400).json({ error: "Only registration tools allowed on this endpoint" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2.5 Test Connection Endpoint
import { testConnection } from './handlers/test_connection.js';
app.post('/api/tools/test-connection', async (req, res) => {
    try {
        const { baseUrl, authConfig } = req.body;
        const result = await testConnection(baseUrl, authConfig);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 2.6 Analyze Auth Endpoint
import { analyzeAuthFromDocs } from './handlers/auth_analyzer.js';
app.post('/api/tools/analyze-auth', async (req, res) => {
    try {
        const { docsUrl, docsContent, docsAuth } = req.body;
        console.log(`[API Server] Analyzing Auth from ${docsUrl || 'Text Content'}`);
        const config = await analyzeAuthFromDocs(docsUrl, docsContent, docsAuth);
        res.json({ success: true, config });
    } catch (e) {
        console.error("[API Server] Auth Analysis Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Get tools for a specific resource
app.get('/api/resources/:type/:id/tools', async (req, res) => {
    const { type, id } = req.params;
    console.log(`[API] Get tools request: type=${type}, id=${id}`);

    try {
        // Get all tools from toolService
        const allTools = await toolService.getAllTools();

        // Filter tools for this specific resource
        const resourceTools = allTools.filter(tool => {
            const execInfo = toolService.executionMap.get(tool.name);

            if (type === 'api') {
                // Check if tool belongs to this API
                return execInfo?.type === 'mcp' && tool.name.includes(`api_${id}`);
            } else if (type === 'db') {
                // Check if tool belongs to this DB
                return execInfo?.type === 'mcp' && tool.name.includes(`db_${id}`);
            }

            return false;
        });

        console.log(`[API] Found ${resourceTools.length} tools for ${type} ${id}`);
        res.json(resourceTools);
    } catch (e) {
        console.error(`[API] Get tools error:`, e);
        res.status(500).json({ error: e.message });
    }
});

// --- AUTH PROFILE MANAGEMENT ---
import { resourceEnricher } from './src/core/ResourceEnricher.js';

app.get('/api/resources/:id/auth-profiles', (req, res) => {
    const profiles = resourceEnricher.getProfiles(req.params.id);
    res.json(profiles);
});

app.post('/api/resources/:id/auth-profiles', async (req, res) => {
    const profile = await resourceEnricher.addProfile(req.params.id, req.body);
    res.json(profile);
});

app.put('/api/resources/:id/auth-profiles/:profileId', async (req, res) => {
    const updated = await resourceEnricher.updateProfile(req.params.id, req.params.profileId, req.body);
    if (!updated) return res.status(404).json({ error: "Profile not found or update failed" });
    res.json(updated);
});

app.delete('/api/resources/:id/auth-profiles/:profileId', async (req, res) => {
    await resourceEnricher.removeProfile(req.params.id, req.params.profileId);
    res.json({ success: true });
});

// TEST AUTH Endpoint
app.post('/api/resources/:id/auth-profiles/test', async (req, res) => {
    const { id } = req.params;
    const { credentials, profileId } = req.body;

    console.log(`[API] Testing Auth for Resource ${id} (Profile: ${profileId || 'Temp'})...`);

    try {
        // 1. Find the Auth Tool
        const allTools = await toolService.getAllTools();
        const authTool = allTools.find(t =>
            t.name.includes(id) &&
            (t.name.includes('auth') || t.name.includes('login') || t.name.includes('session'))
        );

        if (!authTool) {
            return res.status(404).json({ error: "No authentication tool found for this resource." });
        }

        console.log(`[API] Using Auth Tool: ${authTool.name}`);

        // 2. Execute with credentials
        const result = await toolService.executeTool(authTool.name, credentials);

        // 3. Analyze Result for Role/Success
        let success = !result.isError;
        let detectedRole = null;
        let userData = {};
        let message = "Auth executed.";

        if (result.content && result.content[0]) {
            const text = result.content[0].text;
            message = text;

            // Initial Heuristics for success
            if (text.includes('Error') || text.includes('Falha') || text.includes('401') || text.includes('403')) {
                success = false;
            }

            // Try to parse JSON output to extract User Data
            try {
                const json = JSON.parse(text);
                userData = json;

                // Normalize fields
                if (json.role) detectedRole = json.role;
                else if (json.type) detectedRole = json.type;
                else if (json.user && json.user.role) detectedRole = json.user.role;

                // Fallback Heuristics checks if JSON parse didn't find role
                if (!detectedRole) {
                    if (text.toLowerCase().includes('admin')) detectedRole = 'Admin';
                    else if (text.toLowerCase().includes('company') || text.toLowerCase().includes('empresa')) detectedRole = 'Company';
                    else if (text.toLowerCase().includes('senai')) detectedRole = 'SENAI User';
                }

            } catch (e) {
                // Text fallback
                if (text.toLowerCase().includes('admin')) detectedRole = 'Admin';
                else if (text.toLowerCase().includes('company') || text.toLowerCase().includes('empresa')) detectedRole = 'Company';
                else if (text.toLowerCase().includes('senai')) detectedRole = 'SENAI User';
            }
        }

        // 4. SYNC PROFILE (If strictly successful and we have a profileId)
        if (success && profileId) {
            const updates = {};
            if (detectedRole) updates.role = detectedRole;

            // --- AUTO-ENRICHMENT LOGIC ---
            // Extract Name
            let name = userData.name || (userData.user && userData.user.name) || userData.nome || userData.fantasyName;
            if (name) {
                // Formatting: "Ubirajara (Petrobras)" or "Rafael (SENAI Admin)"
                // Heuristic: If name is generic email, use Role. If real name, use it.
                if (!name.includes('@')) {
                    updates.label = `${name} (${detectedRole || 'User'})`;
                }
            }

            // Extract Context (CNPJ, Unit ID) for Description
            let contextInfo = [];
            if (userData.cnpj) contextInfo.push(`CNPJ: ${userData.cnpj}`);
            if (userData.unitId) contextInfo.push(`Unit ID: ${userData.unitId}`);
            if (userData.fantasyName) contextInfo.push(`Fantasy: ${userData.fantasyName}`);

            if (contextInfo.length > 0) {
                updates.description = `[Auto-Synced] Authenticated as ${name || 'User'}. ${contextInfo.join(', ')}.`;
            }

            // Sync Credentials if we found better/new ones (e.g. planner guessed email, but response gave correct one? - usually response doesn't give password back, so be careful)
            if (userData.cnpj) {
                // If it's a company, ensure CNPJ is in credentials for future use
                updates.credentials = { ...credentials, cnpj: userData.cnpj };
            }

            // Clean sensitive data from userData before saving if needed, but for now strict 1:1 map
            if (userData.id) updates.externalId = userData.id;
            updates.lastAuthData = userData;
            updates.lastAuthTime = new Date().toISOString();

            if (Object.keys(updates).length > 0) {
                console.log(`[API] Syncing Profile ${profileId} with updates:`, updates);
                resourceEnricher.updateProfile(id, profileId, updates);
            }
        }

        res.json({
            success,
            detectedRole: detectedRole || "Unknown",
            toolName: authTool.name,
            output: message
        });

    } catch (e) {
        console.error("Auth Test Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Resource Management (List/Delete)
app.get('/api/resources', async (req, res) => {
    const resources = await toolService.getRegisteredResources();
    res.json(resources);
});

app.delete('/api/resources/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const success = await toolService.deleteResource(type, id);
    if (success) {
        await toolService.getAllTools(); // Refresh cache
        res.json({ success: true });
    } else {
        res.status(500).json({ error: "Failed to delete" });
    }
});

app.put('/api/resources/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await toolService.updateResource(type, id, req.body);
        await toolService.getAllTools(); // Refresh cache
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/resources/:type/:id/toggle', async (req, res) => {
    const { type, id } = req.params;
    console.log(`[API] Toggle request: type=${type}, id=${id}`);

    try {
        let resource;
        if (type === 'api') {
            const current = await prisma.verifiedApi.findUnique({ where: { idString: id } });
            if (!current) {
                console.error(`[API] API resource not found: ${id}`);
                return res.status(404).json({ error: "Resource not found" });
            }

            resource = await prisma.verifiedApi.update({
                where: { idString: id },
                data: { isEnabled: !current.isEnabled }
            });
            console.log(`[API] Toggled API '${resource.name}' to ${resource.isEnabled}`);
        } else if (type === 'db') {
            const current = await prisma.verifiedDb.findUnique({ where: { idString: id } });
            if (!current) {
                console.error(`[API] DB resource not found: ${id}`);
                return res.status(404).json({ error: "Resource not found" });
            }

            resource = await prisma.verifiedDb.update({
                where: { idString: id },
                data: { isEnabled: !current.isEnabled }
            });
            console.log(`[API] Toggled DB '${resource.name}' to ${resource.isEnabled}`);
        } else {
            console.error(`[API] Invalid resource type: ${type}`);
            return res.status(400).json({ error: "Invalid resource type" });
        }

        // Reload MCP Client to reflect changes
        console.log(`[API] Reloading MCP Client...`);
        const { mcpClientService } = await import('./services/mcpClientService.js');
        await mcpClientService.reload();
        console.log(`[API] MCP Client reloaded successfully`);

        res.json(resource);
    } catch (e) {
        console.error(`[API] Toggle error:`, e);
        res.status(500).json({ error: e.message });
    }
});

// 5. Tool Management Details
app.get('/api/resources/:type/:id/tools', async (req, res) => {
    const { type, id } = req.params;
    try {
        const tools = await toolService.getResourceTools(type, id);
        res.json(tools);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/resources/:type/:id/refresh', async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await toolService.refreshResource(type, id);
        await toolService.getAllTools(); // Refresh cache
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Canvas Persistence
app.get('/api/canvases', async (req, res) => {
    try {
        const canvases = await storageService.getAllCanvases();
        res.json(canvases);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/canvases/:id', async (req, res) => {
    try {
        const canvas = await storageService.getCanvas(req.params.id);
        if (!canvas) return res.status(404).json({ error: "Canvas not found" });
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/canvases', async (req, res) => {
    try {
        const { id, title, widgets, messages, groupId } = req.body;
        // Generate random ID if not provided
        const canvasId = id || Math.random().toString(36).substr(2, 9);
        const canvas = await storageService.saveCanvas(canvasId, title, widgets, messages, groupId);
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/canvases/:id', async (req, res) => {
    try {
        const { title, widgets, messages, groupId } = req.body;
        const canvas = await storageService.saveCanvas(req.params.id, title, widgets, messages, groupId);
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// New: Append widgets to existing canvas (incremental mode)
app.post('/api/canvases/:id/append', async (req, res) => {
    try {
        const { widgets } = req.body;
        if (!widgets || !Array.isArray(widgets)) {
            return res.status(400).json({ error: 'Widgets array required' });
        }
        const canvas = await storageService.appendWidgets(req.params.id, widgets);
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// New: Link two canvases together
app.post('/api/canvases/:id/link/:targetId', async (req, res) => {
    try {
        const { label } = req.body;
        const result = await storageService.linkCanvases(req.params.id, req.params.targetId, label);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// New: Get related canvases (linked + same group)
app.get('/api/canvases/:id/related', async (req, res) => {
    try {
        const related = await storageService.getRelatedCanvases(req.params.id);
        res.json(related);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/canvases/:id', async (req, res) => {
    try {
        const success = await storageService.deleteCanvas(req.params.id);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Canvas not found' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Settings
import { getSettings, updateSetting } from './handlers/settings.js';
app.get('/api/settings', getSettings);
app.post('/api/settings', updateSetting);

// 7. GitHub Copilot Auth
import { startCopilotAuth, pollCopilotToken, listCopilotModels, getCopilotUser, handleCallback } from './handlers/copilot_auth.js';
app.post('/api/auth/copilot/start', startCopilotAuth);
app.post('/api/auth/copilot/poll', pollCopilotToken);
app.get('/api/copilot/models', listCopilotModels);
app.get('/api/copilot/user', getCopilotUser);
app.get('/api/auth/callback', handleCallback);


// Initialize Resource Enricher (Load from DB)
await resourceEnricher.loadProfiles();

app.listen(PORT, () => {
    console.log(`API Bridge running on http://localhost:${PORT}`);
});
