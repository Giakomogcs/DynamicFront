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
        const selectedToolNames = plan.tools || [];
        console.log(`[Orchestrator] Planner selected: [${selectedToolNames.join(', ')}]`);
        console.log(`[Orchestrator] Strategy: ${plan.thought}`);

        // Filter Tools
        const activeTools = allGeminiTools.filter(t => selectedToolNames.includes(t.name));

        // 3. EXECUTE
        console.log(`[Orchestrator] Step 3: Executing with ${activeTools.length} tools...`);
        const executionResult = await executorAgent.execute(userMessage, history, modelName, activeTools);
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
