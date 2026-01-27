// Configure UTF-8 encoding FIRST
import './src/utils/utf8-config.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from './src/registry.js';
import dotenv from 'dotenv';
dotenv.config();

// Import our MCP Logic (Force Restart 2)
import { toolService } from './src/services/toolService.js';
import { storageService } from './src/services/storageService.js';
import { orchestrator } from './src/agents/Orchestrator.js';
import { modelManager } from './src/services/ai/ModelManager.js';
import { tokenTracker } from './src/services/ai/TokenTrackingService.js';

// Import routes
// Import routes
import sessionRoutes from './src/routes/sessionRoutes.js';
import widgetRoutes from './src/routes/widgetRoutes.js';
import authRoutes from './src/routes/auth.js';
import passport from './src/config/passport.js';
import { resourceEnricher } from './src/core/ResourceEnricher.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true, // Reflects the request origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(passport.initialize());


// Ensure UTF-8 for all responses
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/widgets', widgetRoutes);

import adminRoutes from './src/routes/admin.js';
app.use('/api/admin', adminRoutes);

// Test Routes (Phase 1 Dev Only)
import testRoutes from './src/routes/testRoutes.js';
app.use('/api/test', testRoutes);



// --- Endpoints ---

// 1. System Status (Onboarding Check)
// 1. System Status (Onboarding Check)
app.get('/api/system/status', async (req, res) => {
    console.log('[API] /api/system/status requested');
    try {
        // Clear models cache to ensure we pick up recent provider toggles/keys
        await modelManager.reload();

        const resources = await toolService.getRegisteredResources();
        // User Request: Status only counts ENABLED resources AND valid USER resources (not system/internal)
        // Filter out INTERNAL system resources so they don't count towards user resources
        const activeApis = resources.apis?.filter(a =>
            a.isEnabled !== false &&
            !a.name?.includes('Gemini Internal') &&
            !a.name?.includes('DataNavigator') &&
            !a.name?.includes('Gemini CLI') &&
            !a.idString?.startsWith('sys-') // Future proofing for system IDs
        ) || [];

        const activeDbs = resources.dbs?.filter(d => d.isEnabled !== false) || [];
        const hasResources = activeApis.length > 0 || activeDbs.length > 0;

        // Check for *configured* models (not just default fallback)
        const models = await modelManager.getAvailableModels();

        // Also check for ConnectedProvider (Gemini CLI) even if models list is empty
        const connectedProviders = await prisma.connectedProvider.findMany({
            where: { isEnabled: true }
        });

        // Check for Copilot Token AND Enabled Status
        const copilotSetting = await prisma.systemSetting.findUnique({
            where: { key: 'GITHUB_COPILOT_TOKEN' }
        });
        const copilotEnabledSetting = await prisma.systemSetting.findUnique({
            where: { key: 'PROVIDER_ENABLED_COPILOT' }
        });

        // Copilot is only "active" if token exists AND it's not explicitly disabled
        const hasCopilot = copilotSetting && copilotSetting.value && copilotSetting.value.length > 10 &&
            (copilotEnabledSetting?.value !== 'false');

        const hasModels = models.length > 0;

        console.log(`[API] /api/system/status: hasModels=${hasModels}, hasResources=${hasResources}`);

        res.json({
            initialized: hasModels && hasResources,
            hasModels,
            hasResources,
            resourceCount: (resources.apis?.length || 0) + (resources.dbs?.length || 0),
            connectedProviders: connectedProviders.length,
            hasCopilot
        });
    } catch (e) {
        console.error('[API] /api/system/status error:', e.message);
        res.status(500).json({ error: e.message });
    }
});




// 1.5 Chat Endpoint (Models)
app.get('/api/models', async (req, res) => {
    try {
        const showAll = req.query.all === 'true';
        // Ensure settings are fresh if we are in a configuration phase
        if (showAll || req.query.refresh === 'true') {
            await modelManager.reload();
        }
        const models = await modelManager.getAvailableModels(true, !showAll);

        // Dynamic Default: Pick the flagship model of the first available healthy provider
        let defaultModel = "gemini-2.0-flash";

        // Find first healthy provider
        const firstProvider = modelManager.providers.values().next().value;
        if (firstProvider && modelManager.isProviderHealthy(firstProvider.id)) {
            if (firstProvider.getDefaultModel) {
                defaultModel = firstProvider.getDefaultModel();
            } else if (models.length > 0) {
                defaultModel = models[0].name;
            }
        } else if (models.length > 0) {
            // If we found models but maybe provider health is weird, try from models list
            defaultModel = models[0].name;
        }

        res.json({
            models,
            defaultModel
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/providers/:id/validate', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Force settings reload to ensure we have the latest keys from DB
        // Optimized: Refresh ONLY this provider instead of reloading the entire system
        await modelManager.refreshProvider(id);

        // 2. Force validation
        const isValid = await modelManager.forceRevalidate(id);

        // 3. Get updated status
        const status = await modelManager.getProviderStatuses();

        res.json({
            valid: isValid,
            status: status[id],
            timestamp: Date.now()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/providers', async (req, res) => {
    try {
        const statuses = await modelManager.getProviderStatuses();
        res.json(statuses);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Token Usage & Analytics Endpoints
app.get('/api/tokens/usage', async (req, res) => {
    try {
        const { timeframe = '24h', providerId } = req.query;
        const stats = await tokenTracker.getUsageStats(providerId, timeframe);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tokens/costs', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const costs = await tokenTracker.getCostAnalysis(timeframe);
        res.json(costs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CHAT MANAGEMENT ENDPOINTS ---

app.post('/api/chats', async (req, res) => {
    try {
        const { sessionId, title } = req.body;
        if (!sessionId) return res.status(400).json({ error: "Session ID required" });
        const chat = await storageService.createChat(sessionId, title);
        res.json(chat);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sessions/:id/chats', async (req, res) => {
    try {
        const chats = await storageService.getProjectChats(req.params.id);
        res.json(chats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/chats/:id', async (req, res) => {
    try {
        const chat = await storageService.getChat(req.params.id);
        if (!chat) return res.status(404).json({ error: "Chat not found" });
        res.json(chat);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/chats/:id', async (req, res) => {
    try {
        const { title, messages } = req.body;
        const chat = await storageService.updateChat(req.params.id, messages, title);
        res.json(chat);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/chats/:id', async (req, res) => {
    try {
        const success = await storageService.deleteChat(req.params.id);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 1. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, location, model, canvasContext, sessionId, chatId } = req.body;
        console.log(`[API Server] Received chat request: "${message?.substring(0, 50)}..." (ChatID: ${chatId})`);

        let targetChatId = chatId;

        // Auto-create chat if missing but session exists (fallback for old UI or direct calls)
        if (!targetChatId && sessionId) {
            console.log('[API] No Chat ID provided, creating new chat for session...');
            const newChat = await storageService.createChat(sessionId, "New Chat");
            targetChatId = newChat.id;
        }

        // Delegate entire process to the Multi-Agent Orchestrator
        const result = await orchestrator.processRequest(message, history, model, location, canvasContext);

        // PERSISTENCE: Save updated history to the Chat
        if (targetChatId) {
            // Construct new history: Old History + User Message + Model Response
            // Note: 'history' in body was the client's view. 
            // Better to append to what's in DB or trust the client history + new?
            // Trusting client history + new response is standard for stateless-ish APIs, 
            // but for robust persistence, we should overwrite with the full chain or append safely.
            // Let's stick to: History passed in + User Msg (already in history?) + Model Msg.
            // Actually, frontend usually Optimistically adds User Msg. 
            // The `result.text` is the model response.

            // Standardize: The `history` param received usually INCLUDES the connection of previous messages.
            // Does it include the *current* user message? Frontends differ.
            // Looking at App.jsx: `setMessages(prev => [...prev, { role: 'user', text }])` THEN calls API with `history: messages`.
            // So `history` includes the new user message.

            const newMessages = [
                ...history,
                {
                    role: 'model',
                    text: result.text,
                    thought: result.thought, // Persist thought
                    toolCalls: result.toolCalls, // Persist tool calls
                    error: result.error
                }
            ];

            // Background save (fire and forget for speed, or await for consistency)
            await storageService.updateChat(targetChatId, newMessages);

            // Update title if it's the first few messages and title is default?
            // (Optional enhancement for later)
        }

        // Return result with ChatID so client knows (if it was auto-created)
        res.json({ ...result, chatId: targetChatId });

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
import { testConnection } from './src/handlers/test_connection.js';
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
import { analyzeAuthFromDocs } from './src/handlers/auth_analyzer.js';
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

            // Initial Heuristics for failure
            if (text.includes('Error') || text.includes('Falha') || text.includes('401') || text.includes('403')) {
                success = false;
            }

            // AI ANALYSIS for Role Detection
            try {
                const prompt = `
                    Analyze this authentication response context and extract the user's role if present.
                    
                    Tool Output:
                    ${text.substring(0, 2000)}

                    Credentials Used: ${JSON.stringify(credentials)}

                    Return ONLY a JSON object with this structure:
                    {
                        "success": boolean, // Does this look like a successful login?
                        "role": string | null, // The detected user role (e.g. "Admin", "User", "Editor") or normalization of it.
                        "confidence": number, // 0-1
                        "explanation": string // Short reason
                    }
                    `;

                const aiRes = await modelManager.generateContent(prompt, { model: 'gemini-1.5-flash' });
                const aiText = aiRes.response.text();

                // Cleanup JSON
                const jsonStr = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                const analysis = JSON.parse(jsonStr);

                if (analysis.success !== undefined) success = analysis.success;
                if (analysis.role) detectedRole = analysis.role;

                console.log(`[Auth Test] AI Analysis:`, analysis);

            } catch (e) {
                console.warn("[Auth Test] AI Analysis failed:", e.message);
                // Fallback to manual JSON parse if simple
                try {
                    const json = JSON.parse(text);
                    if (json.role) detectedRole = json.role;
                } catch { }
            }
        }

        // 4. SYNC PROFILE (If strictly successful and we have a profileId)
        if (success && profileId) {
            const updates = {};
            if (detectedRole) updates.role = detectedRole;

            // --- AUTO-ENRICHMENT LOGIC ---
            // Try to parse basic user data for name
            try {
                const json = JSON.parse(result.content[0].text);
                userData = json;
            } catch { }

            let name = userData.name || (userData.user && userData.user.name) || userData.nome || userData.fantasyName;
            if (name) {
                // Formatting: "Ubirajara (Petrobras)" or "Rafael (SENAI Admin)"
                // Heuristic: If name is generic email, use Role. If real name, use it.
                // Refined Logic: Respect User Label if it's already descriptive.

                // Get current profile if possible (we have profileId but not the full object easily here without DB fetch, 
                // but we can assume we want to be append-only or non-destructive).

                // If it's a completely new profile or we want to overwrite 'New User':
                // For now, simpler logic: 
                // matches what user asked: "apenas dar uma detalhada a mais não mudar drasticamente"
                // So, let's just append the detected role if it's not there, OR update if it looks like an email.

                if (!name.includes('@')) {
                    // e.g. "Ubirajara Sardinha"
                    // If detectedRole is "Enterprise Admin", we want "Ubirajara Sardinha (Enterprise Admin)"
                    updates.label = `${name} (${detectedRole || 'User'})`;
                }
            }

            // Extract Context (CNPJ, Unit ID) for Description
            let contextInfo = [];
            if (userData.cnpj) contextInfo.push(`CNPJ: ${userData.cnpj}`);
            if (userData.unitId) contextInfo.push(`Unit ID: ${userData.unitId}`);
            if (userData.fantasyName) contextInfo.push(`Fantasy: ${userData.fantasyName}`);

            if (contextInfo.length > 0) {
                updates.description = `[Synced] Authenticated as ${name || 'User'}. ${contextInfo.join(', ')}.`;
            }

            // Sync Credentials - DISABLED by request for safety.
            // User does not want auto-injection of keys like 'cnpj' into the auth body to prevent breakage.
            /* 
            if (userData.cnpj) {
                updates.credentials = { ...credentials, cnpj: userData.cnpj };
            } 
            */

            // Clean sensitive data from userData before saving if needed, but for now strict 1:1 map
            if (userData.id) updates.externalId = userData.id;
            updates.lastAuthData = userData;
            updates.lastAuthTime = new Date().toISOString();

            if (Object.keys(updates).length > 0) {
                console.log(`[API] Syncing Profile ${profileId} with updates:`, updates);
                try {
                    await resourceEnricher.updateProfile(id, profileId, updates);
                } catch (e) {
                    console.error("[API] Failed to sync profile updates:", e);
                }
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
    // Filter out INTERNAL system resources (DataNavigator) so they don't clutter the user UI
    if (resources.apis) {
        resources.apis = resources.apis.filter(api => api.name !== 'DataNavigator' && api.idString !== 'dn-api');
    }
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
        const { mcpClientService } = await import('./src/services/mcpClientService.js');
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
        const { id, title, widgets, messages, groupId, skipGeneration } = req.body;

        // Generate random ID if not provided
        const canvasId = id || Math.random().toString(36).substr(2, 9);

        // CRITICAL FIX: Generate initial widgets if none provided
        let initialWidgets = widgets || [];

        if ((!initialWidgets || initialWidgets.length === 0) && !skipGeneration) {
            console.log('[API] Creating new page without widgets. Generating welcome widget...');

            // Import Designer dynamically
            const { designerAgent } = await import('./src/agents/Designer.js');

            try {
                // Call Designer to generate initial widgets
                const designResult = await designerAgent.design(
                    `Nova página: ${title || 'New Page'}`,
                    [], // No data yet
                    'gemini-2.0-flash', // Default model
                    [{ action: 'create_page', context: title }],
                    null, // No canvas context
                    { action: 'create', reason: 'api_endpoint_create_page' }
                );

                initialWidgets = designResult.widgets || [];
                console.log(`[API] ✨ Designer generated ${initialWidgets.length} widgets for new page`);
            } catch (designError) {
                console.warn('[API] Designer failed, using fallback welcome widget:', designError.message);

                // Fallback: Create welcome widget
                initialWidgets = [{
                    type: 'insight',
                    title: title || 'Nova Página',
                    content: [
                        `## Bem-vindo à ${title || 'nova página'}!`,
                        '',
                        'Esta página foi criada. Use o chat no canto inferior para adicionar widgets e visualizações.',
                        '',
                        '💡 **Dicas**:',
                        '- Peça "adicione um gráfico"',
                        '- Peça "mostre uma tabela com dados"',
                        '- Peça "crie um dashboard"'
                    ],
                    sentiment: 'neutral'
                }];
            }
        }

        const canvas = await storageService.saveCanvas(canvasId, title, initialWidgets, messages, groupId);
        res.json(canvas);
    } catch (e) {
        console.error('[API] Error creating canvas:', e);
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
import { getSettings, updateSetting } from './src/handlers/settings.js';
app.get('/api/settings', getSettings);
app.post('/api/settings', updateSetting);

// 7. GitHub Copilot Auth
import { startCopilotAuth, pollCopilotToken, listCopilotModels, getCopilotUser, handleCallback } from './src/handlers/copilot_auth.js';
app.post('/api/auth/copilot/start', startCopilotAuth);
app.post('/api/auth/copilot/poll', pollCopilotToken);
app.get('/api/copilot/models', listCopilotModels);
app.get('/api/copilot/user', getCopilotUser);
app.get('/api/auth/callback', handleCallback);


// Initialize Resource Enricher (Load from DB)
await resourceEnricher.loadProfiles();

// Initialize Tools Cache
await toolService.getAllTools();

app.listen(PORT, () => {
    console.log(`API Bridge running on http://localhost:${PORT}`);
});
