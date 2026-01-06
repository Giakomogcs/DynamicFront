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

        // Optimize: Send only necessary schema info to save tokens
        const toolSummaries = availableTools.map(t => `- ${t.name}: ${t.description?.substring(0, 150)}`).join('\n');

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
            const result = await geminiManager.generateContentWithFailover(planningPrompt, {
                model: modelName,
                systemInstruction: "You are the PLANNER Agent. Output strictly JSON."
            });
            const text = result.response.text();

            const planJson = this.extractJson(text);
            if (planJson && Array.isArray(planJson.tools)) {
                console.log(`[Planner] Selected: ${planJson.tools.join(', ')}`);
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
