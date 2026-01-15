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
    async plan(userMessage, availableTools, location, modelName, history = []) {
        console.log("[Planner] Analyzing request...");

        // Heuristic: If no tools, return empty.
        if (!availableTools || availableTools.length === 0) return [];

        // Optimize: Smart Compression for many tools
        let toolSummaries = "";

        // ... (existing summary logic is fine, keeping it consistent)
        if (availableTools.length > 300) {
            const groups = {};
            availableTools.forEach(t => {
                const prefix = t.name.split('_')[0];
                if (!groups[prefix]) groups[prefix] = [];
                groups[prefix].push(t);
            });
            const lines = [];
            for (const [prefix, tools] of Object.entries(groups)) {
                if (tools.length > 20) {
                    const names = tools.map(t => t.name).join(', ');
                    lines.push(`- **${prefix.toUpperCase()} Tools** (Count: ${tools.length}): [${names}]...`);
                } else {
                    tools.forEach(t => lines.push(`- ${t.name}: ${t.description?.substring(0, 150)}`));
                }
            }
            toolSummaries = lines.join('\n');
        } else {
            toolSummaries = availableTools.map(t => `- ${t.name}: ${(t.description || '').substring(0, 150).replace(/\s+/g, ' ')}`).join('\n');
        }

        // Context Construction
        const lastBotMessage = history.findLast(m => m.role === 'model' || m.role === 'assistant')?.text || "None";

        const planningPrompt = `
You are the PLANNER Agent.
User Request: "${userMessage}"
        Context: ${location ? `Lat ${location.lat}, Lon ${location.lon}` : 'No location'}
Last System Message: "${lastBotMessage.substring(0, 300)}..."

Available Tools:
${toolSummaries}

        CONCEPTS & RECIPES(CRITICAL KNOWLEDGE):
        1. ** CHIT - CHAT vs ACTION(CRITICAL) **:
        - "Hi", "Hello", "How are you?": Return { "tools": [] }.
           - ** EXCEPTION **: If the user talks about a ** DOMAIN TOPIC ** (e.g. "Courses", "Mechatronics", "Schools", "Companies", "Dashboards"), this is ** NOT ** chit - chat.
             - ** YOU MUST USE TOOLS **.
             - * Example *: "What is mechatronics?" -> Don't just define it. **Search for the course** to show where it's offered.
             - * Reason *: The user wants * real - time data * from the system, not a Wikipedia definition.
             - * Distinction *: "Schools"(SENAI) are for learning. "Companies"(Enterprises) are for industry partnerships / jobs.Do NOT mix them.

        2. ** "SAGAZ" MODE(PROACTIVE ENRICHMENT) **:
        - The user wants "Sagacity"(Smartness).
           - ** Rule **: If a simplistic question("What is course X?") can be answered BETTER with data("Here is the official curriculum for X at Unit Y..."), ** USE THE TOOLS **.
           - ** Strategy **:
        1. Search for the item(Course / Company) using broad terms.
             2. If location is missing, rely on the "Sagaz" Executor to handle it(do not fail planning).
        3. Return real data(Locations, Curriculums, CNPJs).

        3. ** Search Courses(SENAI) **:
           - ** Recipe **:
        1. ** Find Units **: Call \`dn_schoolscontroller_getshools(city="CityName", name="")\`. 
               - **IMPORTANT**: set \`name\` to EMPTY string. Do NOT filter schools by the course name (e.g. "Mechatronics"). We need ANY school nearby.
             2. **Find Course**: Call \`dn_coursescontroller_searchorderrecommendedcourses(schoolsCnpj=[...], querySearch="CourseName")\`.
             3. **Get Details (Curriculum)**: Call \`dn_coursescontroller_getcoursedetails(courseId=...)\`.
               - **MANDATORY**: Trigger this IMMEDIATELY for the first 1-2 courses found to show "what is learned" (subjects/disciplines) in the initial response. DO NOT WAIT for user to ask "details".
           - **Trigger**: "Mechatronics", "Course", "Learn".
           - **Note**: Even if the user didn't give a city, PLAN THESE STEPS. The Executor will provide a default location.

        4. **Authentication & Security (Prioritize)**:
           - **Rule**: If the user asks for **Dashboards** (Admin/Unit), **Reports**, **Sensitive Data**, or says "Login by default", you MUST include \`authcontroller_session\` as the FIRST tool in your plan.
           - **Trigger**: "Dashboard", "Login", "Entrar", "Contratos", "Private", "Admin".
           - **Action**: Call \`authcontroller_session\`. Ideally followed by the actual data tool.
           - **Strategy**: "Saber 100% se precisa autenticar" -> If the task involves accessing private records (NOT public schools/courses), assume Auth is needed.

        5. **Search Companies (Industry/Enterprises)**:
           - **Trigger**: "Empresa", "Indústria", "Company", "Parceiro", "Near me".
           - **Tool**: \`dn_enterprisecontroller_listenterprise(search_bar="Name", state="UF")\`.
           - **Strategy (NEAR ME)**:
             - The tool only filters by **State**. It does NOT support usage of Lat/Lon directly.
             - **HOWEVER**, calling it with the correct State will return a list.
             - **The Executor will AUTOMATICALLY SORT by distance** if the user location is known. 
             - **Action**: Call \`dn_enterprisecontroller_listenterprise(search_bar="", state="SP")\` (or inferred state).
             - **Search Bar**: If user gave a name ("Selco"), use it. If "companies near me", use "Empresa", "Indústria", or leave empty (System will handle).
             
        6. **FALLBACK PROTOCOLS (HONESTY)**:
           - **WEB SEARCH**: YOU DO NOT HAVE INTERNET ACCESS. You CANNOT search Google/Bing.
           - **Protocol**: If the user asks for something outside of internal data (e.g. "Whats the stock price of Google?", "Weather in Tokyo"), you MUST:
             - Return \`[]\` (Empty Tools).
             - The Executor will then explain: "I can only access the internal database (Schools, Courses, Companies). I do not have external web search capabilities."
           - **Exceptions**: If the user query implies a possibly internal search ("Quem é o diretor?", "Notícias do setor"), try to map it to an internal resource if plausible, otherwise fail gracefully.

INSTRUCTIONS:
1. **Analyze** User Request & Last Message.
2. **Formulate Strategy**.
3. **Select Tools**.
4. **Return JSON**:
   {
     "thought": "Reasoning...",
     "tools": ["tool_1", "tool_2"]
   }
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
