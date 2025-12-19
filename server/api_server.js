process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Import our MCP Logic
import { toolService } from './services/toolService.js';
import { storageService } from './services/storageService.js'; // NEW
import { mapMcpToolsToGemini } from './gemini_adapter.js';

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(bodyParser.json());

// Initialize Gemini
import { geminiManager } from './config/gemini.js';

// Initialize Gemini (Model Manager handles Keys + Models)
// We get the primary model by default, but we can switch logic here if we want to be fancy later
const model = geminiManager.getPrimaryModel({
    systemInstruction: "You are a helpful assistant for DynamicFront. You have access to various tools to fetch data from APIs and Databases. " +
        "When you retrieve data that is suitable for visualization, you MUST append a specific JSON block at the end of your text response. " +
        "Format: \n```json\n{ \"type\": \"chart|table|stat\", \"config\": { ... }, \"data\": [...] }\n```\n" +
        "For charts, use type='chart', config.chartType='bar|line|pie'. Data should be array of objects. " +
        "For tables, use type='table', data is array of objects. " +
        "For stats, use type='stat', data is array of { label, value, change? }. " +
        "ALWAYS explain what you are showing before showing the chart."
});

// Accessing the name just for logging if needed
const modelName = geminiManager.primaryModelName;

// Helper for Retry Logic
async function sendMessageWithRetry(chat, message, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            return await chat.sendMessage(message);
        } catch (error) {
            const isQuota = error.message.includes('429') || error.status === 429;

            if (isQuota && i < retries - 1) {
                let delay = Math.pow(2, i) * 5000; // Default: 5s, 10s, 20s...

                // Smart Delay: Check if Google provided a specific retry time
                if (error.errorDetails) {
                    const retryInfo = error.errorDetails.find(d => d['@type'] && d['@type'].includes('RetryInfo'));
                    if (retryInfo && retryInfo.retryDelay) {
                        // usage: "33.88s" or "33s"
                        const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
                        if (!isNaN(seconds)) {
                            delay = (seconds * 1000) + 1000; // Wait exact time + 1s buffer
                        }
                    }
                }

                console.log(`[429 Quota Exceeded] Retrying in ${Math.ceil(delay / 1000)}s...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
}


// --- Endpoints ---


// 1. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, location } = req.body;

        // Fetch Tools via Service
        const mcpTools = await toolService.getAllTools();
        const geminiTools = mapMcpToolsToGemini(mcpTools);

        // We already initialized 'model' globally with system instructions. 
        // If we want per-request system instructions we might need to change this,
        // but for now, we just pass tools to 'startChat' or re-init here.
        // ACTUALLY: The SDK model instance is reusable but tools are per-chat often.
        // Let's re-instantiate using the manager to be safe and clean.

        // Force 'gemini-2.5-flash' if Pro is failing, or rely on .env (which we updated)
        // Use default model from manager (handles .env keys and rotation)
        const chatModel = geminiManager.getPrimaryModel({
            // model: "gemini-2.5-flash", <--- REMOVED: Respect .env

            tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : [],
            systemInstruction: `You are the "DynamicFront Lead Analyst".
            
**GOAL**: Proactive, Universal Data Analysis.

**CORE PROTOCOLS**:
1. **UNIVERSAL ADAPTER**: You must handle Data from ANY API or Database.
   - If you don't recognize the data structure, visualize it as a TABLE.
   - Do NOT just say "Here is the data". Build a dashboard.
2. **DEEP UNDERSTANDING**: If user asks for "Courses", assume they want a FULL REPORT (Stats, Trends, List).

2. **MULTI-WIDGET GENERATION**:
   - Never return just text if data is involved.
   - ALWAYS generate a dashboard composed of multiple widgets.
   - **Order**: Stats (KPIs) -> Insights (Text) -> Charts -> Tables.

**REQUIRED JSON FORMAT**:
   - Output strict JSON array of widgets inside \`\`\`json\`\`\` blocks.
   - **NO COMMENTS** inside JSON.
   
   **Supported Types**:
   
   1. **stat** (KPI Cards)
   \`\`\`json
   {
     "type": "stat",
     "data": [
       { "label": "Total Courses", "value": "42" },
       { "label": "Most Popular", "value": "Eletricista", "change": "+15%" }
     ]
   }
   \`\`\`

   2. **insight** (Natural Language Findings)
   \`\`\`json
   {
     "type": "insight",
     "title": "Key Findings",
     "content": [
       "The southeast region dominates with 60% of all courses.",
       "There is a shortage of 'Mechanic' courses in Rio de Janeiro."
     ]
   }
   \`\`\`

   3. **chart** (Visuals: bar, line, pie, area)
   \`\`\`json
   {
     "type": "chart",
     "config": { "title": "Courses by State", "chartType": "bar", "dataKey": "state", "valueKey": "count" },
     "data": [ { "state": "SP", "count": 20 }, { "state": "RJ", "count": 15 } ]
   }
   \`\`\`

   4. **table** (Detailed Data)
   \`\`\`json
   {
     "type": "table",
     "data": [ { "Course": "Eletricista", "State": "SP", "Slots": 20 } ]
   }
   \`\`\`
`
        });


        // Sanitize History & Optimize Context
        // 1. Normalize Roles
        let fullHistory = (history || []).map(h => ({
            role: h.role === 'assistant' ? 'model' : h.role, // normalize 'assistant' -> 'model' just in case
            parts: [{ text: h.text }]
        }));

        // 2. Optimization: Limit to last 10 messages to prevent token overflow and 429 Errors
        // This addresses "optimizar requisição" by keeping context lean.
        const MAX_HISTORY = 10;
        let validHistory = fullHistory.slice(-MAX_HISTORY);

        // 3. Ensure First Message is User (Gemini Requirement)
        while (validHistory.length > 0 && validHistory[0].role !== 'user') {
            validHistory.shift();
        }

        const chat = chatModel.startChat({
            history: validHistory
        });

        // Inject Location Context if available
        let finalMessage = message;
        if (location) {
            finalMessage = `[CONTEXT: User's Browser Location is Latitude ${location.lat}, Longitude ${location.lon}. Use this if no city is specified.]\n\n${message}`;
        }

        // Send Message
        // Send Message with Retry
        let result = await sendMessageWithRetry(chat, finalMessage);
        let response = await result.response;

        let text = response.text();
        console.log("--- RAW GEMINI RESPONSE ---");
        console.log(text);
        let functionCalls = response.functionCalls();

        // Agent Loop
        const maxTurns = 3; // Reduced from 5 to prevent hitting rate limits (15 RPM)
        let turn = 0;
        let lastToolResult = null; // Track for safety net

        while (functionCalls && functionCalls.length > 0 && turn < maxTurns) {
            turn++;
            const parts = [];

            for (const call of functionCalls) {
                console.log(`[Agent] Calling Tool: ${call.name}`);
                // Execute via Service
                const toolResult = await toolService.executeTool(call.name, call.args);
                console.log(`[Agent] Tool Result (Length):`, JSON.stringify(toolResult).length);

                // OPTIMIZATION: Truncate massive results to prevent 429 / Token Overflow
                // Especially useful for 'inspect_schema' on large DBs
                let resultText = JSON.stringify(toolResult);
                if (resultText.length > 5000) {
                    console.log(`[Optimization] Truncating large tool result (${resultText.length} chars)`);
                    const partial = resultText.substring(0, 5000) + "... [TRUNCATED due to length]";
                    // We must structure it back as a valid tool response object if possible, 
                    // or just pass the truncated text if the model is flexible. 
                    // But toolResult usually has structure. Let's just truncate the inner text if possible.
                    if (toolResult && toolResult.content && toolResult.content[0] && toolResult.content[0].text) {
                        toolResult.content[0].text = toolResult.content[0].text.substring(0, 5000) + "\n... [TRUNCATED - PLEASE REFINE QUERY OR USE 'query' TOOL]";
                    }
                }

                // Store result for fallback safety net
                lastToolResult = toolResult;

                parts.push({
                    functionResponse: {
                        name: call.name,
                        // Ensure we strictly extract content[0].text if available, Gemini expects specific structure
                        response: toolResult.content ? { content: toolResult.content } : { content: toolResult }
                    }
                });
            }

            result = await sendMessageWithRetry(chat, parts);
            response = await result.response;

            text = response.text();

            functionCalls = response.functionCalls();
        }

        console.log("--- FINAL TEXT TO PARSE ---");
        console.log(text);
        console.log("---------------------------");


        // Parse Widgets - Robust Extraction
        const widgets = [];
        let cleanText = text;

        // Strategy 1: Look for Markdown JSON blocks (```json ... ```)
        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
        let match;
        let foundBlock = false;

        while ((match = jsonBlockRegex.exec(text)) !== null) {
            foundBlock = true;
            try {
                const content = match[1];
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) widgets.push(...parsed);
                else widgets.push(parsed);
                cleanText = cleanText.replace(match[0], '');
            } catch (e) {
                console.error("Failed to parse JSON block:", e);
            }
        }

        // Strategy 2: If no blocks found, look for raw JSON structure if text contains it
        // This handles cases where the model forgets the markdown code fences
        if (!foundBlock) {
            try {
                // Find first '[' or '{'
                const firstOpen = text.search(/[\[\{]/);
                const lastClose = text.search(/[\]\}]/); // This is naive, we need last index

                if (firstOpen !== -1) {
                    // Try to find the *last* closing bracket to grab the full valid JSON
                    const lastSquare = text.lastIndexOf(']');
                    const lastCurly = text.lastIndexOf('}');
                    const end = Math.max(lastSquare, lastCurly);

                    if (end > firstOpen) {
                        const potentialJson = text.substring(firstOpen, end + 1);
                        console.log("Attempting Raw JSON Extraction:", potentialJson);
                        const parsed = JSON.parse(potentialJson);
                        if (Array.isArray(parsed)) widgets.push(...parsed);
                        else widgets.push(parsed);

                        // We assume the rest was text? Or maybe we just clean the JSON part?
                        // Let's keep the text as is for safety if we did raw extraction, 
                        // as removing it cleanly without regex match boundaries is tricky.
                    }
                }
            } catch (e) {
                console.log("Raw JSON extraction failed:", e.message);
            }
        }

        console.log(`Parsed ${widgets.length} widgets.`);

        // --- UNIVERSAL SAFETY NET ---
        // If the AI failed to generate widgets but we have data from tools, FORCE a widget.
        if (widgets.length === 0 && lastToolResult) {
            console.log("Empty widgets detected, engaging Safety Net...");
            try {
                // Check if result content is JSON string
                if (lastToolResult.content && lastToolResult.content[0] && lastToolResult.content[0].text) {
                    const rawData = JSON.parse(lastToolResult.content[0].text);
                    if (Array.isArray(rawData) && rawData.length > 0) {
                        widgets.push({
                            type: 'table',
                            data: rawData.slice(0, 50), // Limit to 50 rows for safety
                            config: { title: "Auto-Generated Data View" }
                        });
                        if (!cleanText) cleanText = "I found some data but couldn't auto-generate a specific dashboard. Here is the raw table.";
                    } else if (typeof rawData === 'object') {
                        // Maybe it's a schema or single object?
                        widgets.push({
                            type: 'insight',
                            title: "Data Result",
                            content: [JSON.stringify(rawData).substring(0, 200) + "..."]
                        });
                    }
                }
            } catch (e) {
                console.error("Safety net failed:", e);
            }
        }



        res.json({ text: cleanText, widgets });

    } catch (error) {
        console.error("Chat Error:", error);
        // Ensure we send a response so frontend doesn't hang
        res.status(500).json({
            text: "I am experiencing heavy traffic (Rate Limit). Please try again in a minute.",
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

app.listen(PORT, () => {
    console.log(`API Bridge running on http://localhost:${PORT}`);
});
