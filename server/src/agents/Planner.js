import { modelManager } from '../services/ai/ModelManager.js';
import fs from 'fs';
import { resourceEnricher } from '../core/ResourceEnricher.js';
import { aiUtils } from '../utils/aiUtils.js';
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

        // NEW: Enforce Context & History Usage
        const recentHistory = history.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.text.substring(0, 200)}`).join('\n');

        const planningPrompt = `
You are the PLANNER Agent. 
Your goal: Select tools to fulfill the user request, CONSIDERING the Conversation History and Existing Page Context.

User Request: "${userMessage}"
Context: ${location ? `Lat ${location.lat}, Lon ${location.lon}` : 'No location'}
History (Last 5):
${recentHistory}

${canvasInfo}${authInfo}

AVAILABLE TOOLS (Total: ${availableTools.length}):
${toolSummaries}

AVAILABLE AUTH FILES:
${profilesList}

*** STRATEGY & OPTIMIZATION ***
1. **CONTEXT AWARENESS**:
   - Look at "EXISTING CANVAS CONTEXT". If the page already has a "Schools Table", and the user says "Filter by City X", use an UPDATE tool or re-fetch with new args.
   - Look at "History". If the user is refining a previous query, merge the new constraints.

2. **DYNAMIC TOOL SELECTION (Sagaz Mode)**:
   - Identify NOUNS in the request ("Clients", "Products").
   - Find matching tools in the [AVAILABLE TOOLS] list.
   - **Protocol**: 
     - If "List/Search": Use \`list_*\` or \`search_*\` tools.
     - If "Details": Use \`get_*\` or \`id_*\` tools.
     - If "Metrics": Use \`dashboard_*\` or \`kpi_*\` tools.

3. **OPTIMIZATION**:
   - DO NOT call redundant tools.
   - If the user asks for "everything", select the top 3 most relevant list tools. Do NOT select 50 tools.

4. **AUTHENTICATION**:
   - If request involves "My Data", "Login", "Private", IMPLICITLY adding \`auth_session\` is allowed if a profile matches.

5. **FALLBACK**:
   - If no tool matches, return [].
`;

        try {
            // Use Queue with Failover
            const finalPrompt = `SYSTEM: You are the PLANNER Agent. Return JSON: { "thought": "...", "tools": ["tool_names"], "auth_strategy": {...} }.\n${planningPrompt}`;


            const result = await modelManager.generateContentWithFailover(finalPrompt, {
                model: modelName,
                jsonMode: true // Critical for Llama 3 / Groq fallback
            });
            const text = result.response.text();

            const planJson = aiUtils.extractJson(text);
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

    // Method removed, using aiUtils instead

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
