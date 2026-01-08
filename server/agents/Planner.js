import { geminiManager } from '../config/gemini.js';
import fs from 'fs';

export class PlannerAgent {
    constructor() { }

    /**
     * Analyzes the user request and selects appropriate tools.
     * @param {string} userMessage 
     * @param {Array} availableTools 
     * @param {Object} location 
     * @param {string} modelName 
     * @returns {Promise<string[]>} Array of selected tool names
     */
    async plan(userMessage, availableTools, location, modelName) {
        console.log("[Planner] Analyzing request...");

        // Heuristic: If no tools, return empty.
        if (!availableTools || availableTools.length === 0) return [];

        // CACHE CHECK: Simple in-memory cache for identical queries
        // This is "economical and viable" for testing/debugging
        if (this.lastPlan &&
            this.lastPlan.query === userMessage.trim().toLowerCase() &&
            this.lastPlan.toolCount === availableTools.length) {
            console.log(`[Planner] ⚡ Using Cached Plan for: "${userMessage.substring(0, 20)}..."`);
            return this.lastPlan.tools;
        }

        // Optimize: Smart Compression for many tools
        let toolSummaries = "";

        if (availableTools.length > 300) { // Only group if EXTREMELY large amount of tools
            // 1. Group by prefix to detect "Related Resources"
            const groups = {};
            availableTools.forEach(t => {
                const prefix = t.name.split('_')[0];
                if (!groups[prefix]) groups[prefix] = [];
                groups[prefix].push(t);
            });

            const lines = [];
            for (const [prefix, tools] of Object.entries(groups)) {
                 // Even in groups, we should try to list them if possible
                 if (tools.length > 20) {
                    // Massive group: List names + Common Prefix Description
                    const names = tools.map(t => t.name).join(', ');
                    lines.push(`- **${prefix.toUpperCase()} Tools** (Count: ${tools.length}): [${names}]...`);
                 } else {
                     tools.forEach(t => lines.push(`- ${t.name}: ${t.description?.substring(0, 150)}`));
                 }
            }
            toolSummaries = lines.join('\n');
        } else {
            // Standard compression: Name + first 150 chars of description
            // Increased from 60 to 150 to ensure "DN" tools context is visible
            toolSummaries = availableTools.map(t => `- ${t.name}: ${(t.description || '').substring(0, 150).replace(/\s+/g, ' ')}`).join('\n');
        }
        console.log(`[Planner] Tool Summaries Length: ${toolSummaries.length} chars`);

        const planningPrompt = `
You are the PLANNER Agent.
User Request: "${userMessage}"
Context: ${location ? `Lat ${location.lat}, Lon ${location.lon}` : 'No location'}

Available Tools:
${toolSummaries}

INSTRUCTIONS:
1. Analyze the request.
2. Select relevant tools.
3. Return a JSON object: { "thought": "...", "tools": ["tool_name"] }
4. If no tools are needed, return { "tools": [] }
`;

        try {
            // Use Queue with Failover
            const finalPrompt = `SYSTEM: You are the PLANNER Agent. You MUST return valid JSON only. Do not wrap in markdown blocks.\n${planningPrompt}`;

            const result = await geminiManager.generateContentWithFailover(finalPrompt, {
                model: modelName,
                jsonMode: true // Critical for Llama 3 / Groq fallback
            });
            const text = result.response.text();

            const planJson = this.extractJson(text);
            if (planJson && Array.isArray(planJson.tools)) {
                if (planJson.thought) {
                    console.log(`[Planner] Thought: "${planJson.thought}"`);
                }
                console.log(`[Planner] Selected: ${planJson.tools.join(', ')}`);

                // Save to Cache
                this.lastPlan = {
                    query: userMessage.trim().toLowerCase(),
                    tools: planJson.tools,
                    toolCount: availableTools.length
                };

                return planJson.tools;
            }
            return [];
        } catch (e) {
            console.error("[Planner] Error:", e);
            fs.writeFileSync('debug_planner.log', `[${new Date().toISOString()}] Error: ${e.message}\n${e.stack}\n`);
            // Fallback: If planning fails, maybe return empty toolset to avoid triggering random things
            return [];
        }
    }

    extractJson(text) {
        try {
            const match = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) return JSON.parse(match[1]);
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) return JSON.parse(text.substring(start, end + 1));
        } catch (e) { return null; }
        return null;
    }
}

export const plannerAgent = new PlannerAgent();
