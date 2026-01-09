process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// Import our MCP Logic
import { toolService } from './services/toolService.js';
import { storageService } from './services/storageService.js';
import { orchestrator } from './agents/Orchestrator.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini
import { geminiManager } from './config/gemini.js';

// --- Endpoints ---


// 1.5 Chat Endpoint (Models)
app.get('/api/models', async (req, res) => {
    try {
        const models = await geminiManager.listAvailableModels();
        // Return both list and the currently configured default (from .env or server fallback)
        res.json({
            models,
            defaultModel: geminiManager.primaryModelName
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 1. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, location, model } = req.body;
        console.log(`[API Server] Received chat request: "${message?.substring(0, 50)}..."`);

        // Delegate entire process to the Multi-Agent Orchestrator
        const result = await orchestrator.processRequest(message, history, model, location);

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
        const { id, title, widgets } = req.body;
        // Generate random ID if not provided (though client should ideally provide one or we generate)
        const canvasId = id || Math.random().toString(36).substr(2, 9);
        const canvas = await storageService.saveCanvas(canvasId, title, widgets);
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/canvases/:id', async (req, res) => {
    try {
        const { title, widgets } = req.body;
        const canvas = await storageService.saveCanvas(req.params.id, title, widgets);
        res.json(canvas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Settings
import { getSettings, updateSetting } from './handlers/settings.js';
app.get('/api/settings', getSettings);
app.post('/api/settings', updateSetting);

app.listen(PORT, () => {
    console.log(`API Bridge running on http://localhost:${PORT}`);
});
