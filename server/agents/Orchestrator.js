import { toolService } from '../services/toolService.js';
import { mapMcpToolsToGemini } from '../gemini_adapter.js';

// Agents
import { plannerAgent } from './Planner.js';
import { executorAgent } from './Executor.js';
import { designerAgent } from './Designer.js';

export class AgentOrchestrator {
    constructor() { }

    async processRequest(userMessage, history, modelName = null, location = null) {
        console.log(`[Orchestrator] Starting process for: "${userMessage?.substring(0, 50)}..."`);

        // 1. Fetch All Tools
        const allMcpTools = await toolService.getAllTools();
        const allGeminiTools = mapMcpToolsToGemini(allMcpTools);

        // 2. PLAN
        const selectedToolNames = await plannerAgent.plan(userMessage, allMcpTools, location, modelName);

        // Filter Tools
        // If planner returns empty, we send NO tools (prevent hallucination) OR all tools? 
        // New Strategy: specific tools only.
        const activeTools = allGeminiTools.filter(t => selectedToolNames.includes(t.name));
        console.log(`[Orchestrator] Logic selected ${activeTools.length} tools.`);

        // 3. EXECUTE
        const executionResult = await executorAgent.execute(userMessage, history, modelName, activeTools);

        // 4. DESIGN
        const finalResult = await designerAgent.design(executionResult.text, executionResult.gatheredData, modelName);

        return finalResult;
    }
}

export const orchestrator = new AgentOrchestrator();
