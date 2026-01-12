import { toolService } from '../services/toolService.js';
import { mapMcpToolsToGemini } from '../gemini_adapter.js';

// Agents
import { plannerAgent } from './Planner.js';
import { executorAgent } from './Executor.js';
import { designerAgent } from './Designer.js';

export class AgentOrchestrator {
    constructor() { }

    async processRequest(userMessage, history, modelName = null, location = null) {
        console.log(`\n=== [Orchestrator] New Request: "${userMessage?.substring(0, 50)}..." ===`);

        // 1. Fetch All Tools
        console.log("[Orchestrator] Step 1: Fetching available tools...");
        const allMcpTools = await toolService.getAllTools();
        const allGeminiTools = mapMcpToolsToGemini(allMcpTools);
        console.log(`[Orchestrator] Found ${allMcpTools.length} total tools.`);

        // 2. PLAN
        console.log("[Orchestrator] Step 2: Planning tool usage...");
        const plan = await plannerAgent.plan(userMessage, allMcpTools, location, modelName);

        // PERSISTENCE: If Planner switched models (failover), update global modelName
        if (plan.usedModel) {
            console.log(`[Orchestrator] 🔄 Planner used model: ${plan.usedModel}. Persisting for next steps.`);
            modelName = plan.usedModel;
        }

        const selectedToolNames = plan.tools || [];
        console.log(`[Orchestrator] Planner selected: [${selectedToolNames.join(', ')}]`);
        console.log(`[Orchestrator] Strategy: ${plan.thought}`);

        // Filter Tools
        let activeTools = allGeminiTools.filter(t => selectedToolNames.includes(t.name));

        // FALLBACK: If Planner hallucinated or returned parsed tool names that don't match,
        // and we have no active tools, UNLEASH THE BEAST (Give all tools).
        if (activeTools.length === 0 && allGeminiTools.length > 0) {
            console.warn(`[Orchestrator] ⚠️ Planner selected tools [${selectedToolNames.join(', ')}] which were NOT found. Falling back to ALL ${allGeminiTools.length} tools.`);

            // Safety: If we have > 100 tools, maybe we should be careful? 
            // For now, Gemini 1.5/2.0 context is huge, so we just pass them all.
            activeTools = allGeminiTools;
        }

        // 3. EXECUTE
        console.log(`[Orchestrator] Step 3: Executing with ${activeTools.length} tools...`);
        // Enhance User Message with the Plan Strategy so Executor knows strictly what to do
        const enhancedContext = `
[PLANNER STRATEGY]: ${plan.thought}
[PLANNED STEPS]: ${JSON.stringify(plan.steps)}
`;
        const executionResult = await executorAgent.execute(userMessage, history, modelName, activeTools, enhancedContext);

        // PERSISTENCE: If Executor switched models (failover), update global modelName
        if (executionResult.usedModel) {
            console.log(`[Orchestrator] 🔄 Executor used model: ${executionResult.usedModel}. Persisting for next steps.`);
            modelName = executionResult.usedModel;
        }

        console.log("[Orchestrator] Execution finished. Gathering result...");

        // 4. DESIGN
        // Pass Plan Strategy/Steps to Designer for better visualization
        console.log("[Orchestrator] Step 4: Designing output widgets...");
        const finalResult = await designerAgent.design(
            executionResult.text,
            executionResult.gatheredData,
            modelName,
            plan.steps // New arg
        );
        console.log("=== [Orchestrator] Process Complete ===\n");

        return finalResult;
    }
}

export const orchestrator = new AgentOrchestrator();
