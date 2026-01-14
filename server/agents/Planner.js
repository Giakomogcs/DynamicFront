import { modelManager } from '../services/ai/ModelManager.js';
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

        // CACHE CHECK: Disabled for stability
        // if (this.lastPlan &&
        //     this.lastPlan.query === userMessage.trim().toLowerCase() &&
        //     this.lastPlan.toolCount === availableTools.length) {
        //     console.log(`[Planner] ⚡ Using Cached Plan for: "${userMessage.substring(0, 20)}..."`);
        //     return this.lastPlan.tools;
        // }

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

CONCEPTS & RECIPES (CRITICAL KNOWLEDGE):
1. **Search Courses (SENAI)**:
   - You CANNOT search courses directly with just a city name.
   - **Recipe**: 
     1. Call \`dn_companiescontroller_getsenaiunits(city="CityName")\` to find Units.
     2. Extract the \`cnpj\` of the found units. (Process Step).
     3. Call \`dn_coursescontroller_searchorderrecommendedcourses(schoolsCnpj=[list_of_cnpjs])\` etc.
   - **Note**: If the user asks for "Courses in Diadema", you MUST Plan step 1 (Get Units) before Step 2 (Get Courses).

2. **Enterprise Context**:
   - Many tools require a \`cnpj\`. If the user represents a company, try to infer or ask for it. If generic search, use the "Search Courses" recipe above which uses *School* CNPJs.


3. **Authentication Strategy**:
   - If the user asks for protected data (e.g. "my courses", "company data") OR if you are using tools that seem to require a session (like "authcontroller" exists), you SHOULD consider if authentication is needed.
   - **Recipe**:
     1. If \`authcontroller_session\` exists, verify if the user has provided credentials or if you need to ask for them.
     2. If you are unsure, INCLUDE \`authcontroller_session\` in your plan so the Executor can decide.
     3. If the user mentions "Login" or "Entrar", definitely use \`authcontroller_session\`.

INSTRUCTIONS:
1. **Analyze** the User's request. Identify the Core Intent (e.g., "Comparison", "Search", "Aggregation").
2. **Formulate a Strategy**: Create a logical pipeline of steps.
   - **Step 1**: Data Retrieval (What tools to call?)
   - **Step 2**: Data Processing/Filtering (How to refine the data?)
   - **Step 3**: Visualization (What is the best way to show this?)
3. **Select Tools**: Identify ALL tools needed for this pipeline.
   - If the user asks for "Cursos SENAI", you MUST select tools related to "courses" AND "branches" (if location is needed).
   - If the user asks for "Maps", ensure you select a tool that returns Geocoordinates.
4. **Return JSON**:
   {
     "thought": "Brief explanation of the strategy.",
     "tools": ["tool_name_1", "tool_name_2"],
     "steps": [
       { 
         "name": "Step Name", 
         "description": "What to do in this step", 
         "expected_tools": ["tool_name_1"] 
       }
     ]
   }
5. If no tools are relevant, return { "tools": [] }.
`;

        try {
            // Use Queue with Failover
            const finalPrompt = `SYSTEM: You are the PLANNER Agent. You MUST return valid JSON only. Do not wrap in markdown blocks.\n${planningPrompt}`;

            const result = await modelManager.generateContentWithFailover(finalPrompt, {
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

                // RETURN FULL PLAN OBJECT
                return {
                    tools: planJson.tools,
                    thought: planJson.thought,
                    steps: planJson.steps || [],
                    usedModel: result.usedModel // <--- Pass back the model useful for Orchestrator
                };
            }
            return { tools: [] };
        } catch (e) {
            console.error("[Planner] Error:", e);
            fs.writeFileSync('debug_planner.log', `[${new Date().toISOString()}] Error: ${e.message}\n${e.stack}\n`);
            // Fallback: If planning fails, maybe return empty toolset to avoid triggering random things
            return { tools: [] };
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
