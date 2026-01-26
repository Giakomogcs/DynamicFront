import { modelManager } from '../services/ai/ModelManager.js';
import fs from 'fs';
import { resourceEnricher } from '../core/ResourceEnricher.js';
import { PlannerOutputSchema } from '../schemas/PlannerOutput.schema.js';
import { NoProfilesAvailableError } from '../errors/AuthErrors.js';

export class PlannerAgent {
    constructor() { }

    /**
     * Analyzes the user request and selects appropriate tools.
     * @param {string} userMessage 
     * @param {Array} availableTools 
     * @param {Object} location 
     * @param {string} modelName 
     * @param {Array} history - Conversation history
     * @param {Object} canvasAnalysis - Canvas context analysis from CanvasContextAnalyzer
     * @returns {Promise<Object>} Plan with tools, thought, and steps
     */
    async plan(userMessage, availableTools, location, modelName, history = [], canvasAnalysis = null, canvasContext = null) {
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

        // Canvas Analysis Context
        let canvasInfo = '';
        if (canvasAnalysis) {
            canvasInfo = `
EXISTING CANVAS CONTEXT:
- Theme: ${canvasAnalysis.theme.primary}${canvasAnalysis.theme.subTheme ? ` / ${canvasAnalysis.theme.subTheme}` : ''}
- Components: ${canvasAnalysis.components.length} (${canvasAnalysis.components.map(c => c.type).join(', ')})
- Tools Used: ${canvasAnalysis.toolsUsed.join(', ') || 'None'}
- Resources: Schools=${canvasAnalysis.resources.schools.length}, Enterprises=${canvasAnalysis.resources.enterprises.length}
`;
        }

        // NEW: Session Context (Sibling Pages)
        if (canvasContext && canvasContext.siblings && canvasContext.siblings.length > 0) {
            const siblingsList = canvasContext.siblings
                .filter(s => !s.isCurrent) // Show other pages
                .map(s => `- "${s.title}" (slug: ${s.slug})`)
                .join('\n');

            if (siblingsList) {
                canvasInfo += `
SESSION CONTEXT (OTHER PAGES):
${siblingsList}
(You can reference these pages or suggest creating similar ones. You can also Navigate to them).
`;
            } else {
                canvasInfo += `\nSESSION CONTEXT: No other pages yet.\n`;
            }
        }

        // CRITICAL: Force Data Fetching for New Pages
        if (canvasContext && canvasContext.forceNewPage) {
            canvasInfo += `
\n[CRITICAL MANDATE]: The user is creating a NEW PAGE titled "${canvasContext.newPageTitle}".
You MUST select tools to fetch data to populate this page.
- If it's a "Schools" page, fetch schools in the area.
- If it's a "Company" page, fetch company details.
- DO NOT return empty tools. The page needs data to be useful.
`;
        }

        // Auth Awareness - (Logic delegated to resourceEnricher)
        let authInfo = ''; // Placeholder if needed in future


        // Auth Awareness
        const profiles = resourceEnricher.getAllProfiles(); // Get ALL registered profiles (Resource + Default)
        const profilesList = profiles.map(p => `- ${p.label} (Role: ${p.role}, Email/User: ${p.credentials?.email || p.credentials?.user || p.credentials?.cnpj || 'N/A'}, ID: ${p.id})`).join('\n');

        const planningPrompt = `
You are the PLANNER Agent.
User Request: "${userMessage}"
        Context: ${location ? `Lat ${location.lat}, Lon ${location.lon}` : 'No location'}
Last System Message: "${lastBotMessage.substring(0, 300)}..."
${canvasInfo}${authInfo}
Available Tools:
${toolSummaries}

Available Authentication Profiles (REGISTERED USERS):
${profilesList}

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

        7. **AUTHENTICATION (PHASE 1)**:
             - **CRITICAL**: Use the **Available Authentication Profiles** above.
             - If the user asks for "Minha Empresa" or "Dashboards", look at the profiles.
             - **SELECT** the most appropriate email (e.g. company email for company data).
             - **OUTPUT** this email in the \`auth_strategy\` field.
             - **DO NOT** ask the user for an email if you have one in the profiles.
             
         6. **FALLBACK PROTOCOLS (HONESTY)**:
            - **WEB SEARCH**: YOU DO NOT HAVE INTERNET ACCESS. You CANNOT search Google/Bing.
            - **Protocol**: If the user asks for something outside of internal data (e.g. "Whats the stock price of Google?", "Weather in Tokyo"), you MUST:
              - Return \`[]\` (Empty Tools).
              - The Executor will then explain: "I can only access the internal database (Schools, Courses, Companies). I do not have external web search capabilities."
            - **Exceptions**: If the user query implies a possibly internal search ("Quem é o diretor?", "Notícias do setor"), try to map it to an internal resource if plausible, otherwise fail gracefully.

         7. **CRITICAL ENFORCEMENT**:
            - NEVER return empty tools array for internal data requests
            - NEVER respond with greetings like "Hello!" or "How can I assist?"
            - For "minha empresa": ALWAYS select dn_authcontroller_session first
            - Answer in PORTUGUESE (same language as user request)
            - If unsure which tool, select multiple related tools

INSTRUCTIONS:
1. **Analyze** User Request & Last Message.
2. **Formulate Strategy** (including Auth).
3. **Select Tools** (NEVER empty for internal requests).
4. **Return JSON** (with auth_strategy):
   {
     "thought": "Reasoning in PORTUGUESE...",
     "tools": ["tool_1", "tool_2"],
     "auth_strategy": {
        "email": "user@example.com",
        "reason": "Why this account"
     }
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
                    auth_strategy: planJson.auth_strategy || null,
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

    /**
     * Extract resource IDs from tool names
     * @param {Array} tools - Array of tool objects
     * @returns {Array<string>} Array of unique resource IDs
     */
    _extractResourcesFromTools(tools) {
        const resources = new Set();
        tools.forEach(tool => {
            // Tool names format: "api_resourceId__controller_action"
            if (tool.name.includes('__')) {
                const parts = tool.name.split('__');
                if (parts[0].startsWith('api_')) {
                    // Extract the resource ID (UUID) from api_uuid format
                    const resourceId = parts[0].replace('api_', '');
                    resources.add(resourceId);
                }
            }
        });
        return Array.from(resources);
    }

    /**
     * Validate plan output with Zod schema
     * @param {Object} planOutput - Raw plan output from LLM
     * @returns {Object} Validated plan
     * @throws {Error} If validation fails
     */
    async _validatePlan(planOutput) {
        try {
            const validated = PlannerOutputSchema.parse(planOutput);

            // If auth_strategy is present, validate profile belongs to resource
            if (validated.auth_strategy) {
                await resourceEnricher.validateProfileBelongsToResource(
                    validated.auth_strategy.profileId,
                    validated.auth_strategy.resourceId
                );
                console.log(
                    `[Planner] ✓ Auth strategy validated: ${validated.auth_strategy.profileId} for ${validated.auth_strategy.resourceId}`
                );
            }

            return validated;
        } catch (error) {
            if (error.issues && Array.isArray(error.issues)) {
                console.error('[Planner] Schema validation failed:', error.issues);
                throw new Error(`Plan validation failed: ${error.issues.map(e => e.message).join(', ')}`);
            }
            throw error;
        }
    }
}

export const plannerAgent = new PlannerAgent();
