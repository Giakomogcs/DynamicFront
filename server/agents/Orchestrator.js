import { toolService } from '../services/toolService.js';
import { mapMcpToolsToAiModels } from '../ToolAdapter.js';

// Agents
import { plannerAgent } from './Planner.js';
import { executorAgent } from './Executor.js';
import { designerAgent } from './Designer.js';

export class AgentOrchestrator {
    constructor() { }

    /**
     * STREAMING Implementation of processRequest
     */
    async processRequestStream(res, userMessage, history, modelName = null, location = null, canvasContext = null) {
        // Helper to send chunks
        const sendChunk = (type, data) => {
            res.write(JSON.stringify({ type, ...data }) + '\n');
        };

        console.log(`\n=== [Orchestrator] New Stream Request: "${userMessage?.substring(0, 50)}..." ===`);
        sendChunk('status', { message: 'Analyzing request...' });

        // 1. Fetch Tools
        const allMcpTools = await toolService.getAllTools();
        const allCompatibleTools = mapMcpToolsToAiModels(allMcpTools);
        
        // 2. PLAN (Recursive Loop for Batches)
        let isDone = false;
        let batchCount = 0;
        let currentContext = canvasContext; // Evolves as we build widgets
        let aggregatedText = "";

        while (!isDone && batchCount < 5) {
            batchCount++;
            console.log(`[Orchestrator] Planning Batch ${batchCount}...`);
            sendChunk('status', { message: `Planning Step ${batchCount}...` });

            try {
                // TODO: Pass 'batchCount' or 'previousSteps' to Planner so it knows to proceed
                const plan = await plannerAgent.plan(userMessage, allMcpTools, location, modelName);
                
                // Smart Model Retention: Only update if valid and not an error-prone internal ID
                if (plan.usedModel && !plan.usedModel.startsWith('/')) {
                     modelName = plan.usedModel;
                }

                const selectedToolNames = plan.tools || [];
                sendChunk('plan', { thought: plan.thought, steps: plan.steps });

                if (selectedToolNames.length === 0) {
                    console.log("[Orchestrator] No tools selected. Finishing.");
                    isDone = true;
                }

                // FILTER TOOLS
                let activeTools = [];
                for (const name of selectedToolNames) {
                    const match = allCompatibleTools.find(t => t.name === name);
                    if (match) activeTools.push(match);
                }

                // 3. EXECUTE
                if (activeTools.length > 0) {
                    sendChunk('status', { message: `Executing ${activeTools.length} tools...` });
                    
                    const executionResult = await executorAgent.execute(userMessage, history, modelName, activeTools, null, location);
                    if (executionResult.usedModel && !executionResult.usedModel.startsWith('/')) {
                        modelName = executionResult.usedModel;
                    }

                    // Stream Execution Logs
                    if (executionResult.gatheredData) {
                        executionResult.gatheredData.forEach(item => {
                            sendChunk('log', { message: `Executed ${item.tool}` });
                        });
                    }

                    // 4. DESIGN (Incremental)
                    sendChunk('status', { message: 'Designing UI updates...' });
                    const designResult = await designerAgent.design(
                        executionResult.text,
                        executionResult.gatheredData,
                        modelName,
                        plan.steps,
                        currentContext
                    );

                    // Update Context for next batch
                    if (designResult.widgets) {
                        if (!currentContext) currentContext = { widgets: [] };
                        currentContext.widgets = designResult.widgets; 
                    }

                    // STREAM WIDGETS
                    sendChunk('ui_update', { 
                        text: designResult.text, 
                        widgets: designResult.widgets 
                    });
                    
                    aggregatedText = designResult.text;

                } else {
                    isDone = true;
                }

                // CHECK: Does Planner want us to continue?
                if (!plan.hasMore) {
                    isDone = true;
                }

                // THROTTLE: Wait 4s before next batch to avoid 429s
                if (!isDone) {
                    await new Promise(r => setTimeout(r, 4000));
                }

            } catch (error) {
                console.error(`[Orchestrator] Batch ${batchCount} failed:`, error);
                
                // If it's a Rate Limit, trigger CONTINGENCY PLAN
                if (error.message.includes('429') || error.message.includes('Quota')) {
                     sendChunk('status', { message: '⚠️ Rate limit hit. Initiating Contingency Plan...' });
                     
                     // 1. Wait
                     await new Promise(r => setTimeout(r, 10000)); // 10s cooldown
                     
                     // 2. Switch Model (Safe Rotation for Copilot Users)
                     const previousModel = modelName || 'gpt-4o';
                     if (previousModel.includes('gpt-4')) {
                         // Downgrade to faster/cheaper model within same provider (likely Copilot)
                         modelName = 'gpt-3.5-turbo';
                     } else if (previousModel.includes('gpt-3.5')) {
                         // Try a different family if supported (Copilot supports Claude-3.5-sonnet often)
                         modelName = 'claude-3.5-sonnet';
                     } else {
                         // Cycle back or try default
                         modelName = 'gpt-4o';
                     }
                     
                     sendChunk('status', { message: `🔄 Switching Strategy: Using model ${modelName}` });
                     console.log(`[Orchestrator] 🔄 Switched model to ${modelName} due to 429.`);

                     // Decrement batchCount so we effectively 'retry' this step slot?
                     // Or just accept the loss of this batch and try next?
                     // Better to continue to next iteration with new model. The Planner will figure it out.
                } else {
                     sendChunk('log', { message: `Batch failed: ${error.message}` });
                     // If critical error, stop
                     isDone = true;
                }
            }
        }

        sendChunk('status', { message: 'Complete' });
        // Final "Done" event
        sendChunk('done', { text: aggregatedText });
    }

    async processRequest(userMessage, history, modelName = null, location = null, canvasContext = null) {
        console.log(`\n=== [Orchestrator] New Request: "${userMessage?.substring(0, 50)}..." ===`);
        if (canvasContext) {
            console.log(`[Orchestrator] Canvas Context: Mode=${canvasContext.mode}, Widgets=${canvasContext.widgets?.length || 0}`);
        }

        // 1. Fetch All Tools
        console.log("[Orchestrator] Step 1: Fetching available tools...");
        const allMcpTools = await toolService.getAllTools();
        const allCompatibleTools = mapMcpToolsToAiModels(allMcpTools);
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

        // Filter Tools with Fuzzy Matching
        let activeTools = [];
        const missingTools = [];

        for (const name of selectedToolNames) {
            // 1. Exact Match
            let match = allCompatibleTools.find(t => t.name === name);

            // 2. Fuzzy Match (if exact not found)
            if (!match) {
                // Try to find by partial inclusion (ignoring case) or edit distance logic (simple version here)
                const lowerName = name.toLowerCase();
                match = allCompatibleTools.find(t => {
                    const tLower = t.name.toLowerCase();
                    // Check for significant overlap (e.g. 80% similarity or containment of core part)
                    // Heuristic: If one is substring of another and length diff is small
                    if (tLower.includes(lowerName) || lowerName.includes(tLower)) return true;

                    // Heuristic: Levenshtein-ish (simple typo check for "schools" vs "school")
                    // Check if stripping standard prefixes matches
                    const coreT = tLower.split('__').pop();
                    const coreN = lowerName.split('__').pop();

                    if (coreT === coreN) return true;

                    // Use real Levenshtein for robust typo tolerance
                    const dist = this._levenshtein(coreT, coreN);
                    if (dist <= 3) return true; // Tolerate up to 3 errors

                    return false;
                });

                if (match) {
                    console.log(`[Orchestrator] 🔧 Fuzzy match: '${name}' -> '${match.name}'`);
                }
            }

            if (match) {
                if (!activeTools.find(t => t.name === match.name)) {
                    activeTools.push(match);
                }
            } else {
                missingTools.push(name);
            }
        }

        // FALLBACK: Only fallback to ALL tools if the planner tried to select tools but we couldn't find ANY of them.
        // If the planner returned an empty list intentionally, we respect that and send NO tools (preventing token overflow).
        if (activeTools.length === 0 && selectedToolNames.length > 0 && allCompatibleTools.length > 0) {
            console.warn(`[Orchestrator] ⚠️ Planner selected tools [${missingTools.join(', ')}] which were NOT found. Falling back to ALL ${allCompatibleTools.length} tools.`);

            // Safety: If we have > 100 tools, maybe we should be careful? 
            // For now, Gemini 1.5/2.0 context is huge, so we just pass them all.
            activeTools = allCompatibleTools;
        }

        // 3. EXECUTE
        console.log(`[Orchestrator] Step 3: Executing with ${activeTools.length} tools...`);
        // Enhance User Message with the Plan Strategy so Executor knows strictly what to do
        const enhancedContext = `
[PLANNER STRATEGY]: ${plan.thought}
[PLANNED STEPS]: ${JSON.stringify(plan.steps)}
`;
        const executionResult = await executorAgent.execute(userMessage, history, modelName, activeTools, enhancedContext, location);

        // PERSISTENCE: If Executor switched models (failover), update global modelName
        if (executionResult.usedModel) {
            console.log(`[Orchestrator] 🔄 Executor used model: ${executionResult.usedModel}. Persisting for next steps.`);
            modelName = executionResult.usedModel;
        }

        console.log("[Orchestrator] Execution finished. Gathering result...");

        // 4. DESIGN
        // Pass Plan Strategy/Steps to Designer for better visualization
        console.log("[Orchestrator] Step 4: Designing output widgets...");

        try {
            const finalResult = await designerAgent.design(
                executionResult.text,
                executionResult.gatheredData,
                modelName,
                plan.steps, // Execution steps
                canvasContext // Canvas context for incremental mode
            );
            console.log("=== [Orchestrator] Process Complete ===\n");

            return finalResult;
        } catch (designError) {
            console.error("[Orchestrator] Designer failed:", designError.message);

            // FALLBACK: Return sanitized text response
            console.log("=== [Orchestrator] Process Complete (with fallback) ===\n");
            return {
                text: this._sanitizeResponse(executionResult.text),
                widgets: []
            };
        }
    }

    _sanitizeResponse(text) {
        if (!text) return "Desculpe, não consegui processar sua solicitação.";

        // Remove function call syntax
        text = text.replace(/<function=.*?<\/function>/g, '');
        text = text.replace(/<function=.*?>/g, '');

        // Remove HTML-like tags
        text = text.replace(/<[^>]+>/g, '');

        // Remove JSON-like function calls
        text = text.replace(/\{"name":\s*"[^"]+",\s*"args":\s*\{[^}]+\}\}/g, '');

        // If text is empty after sanitization, provide friendly message
        if (!text.trim()) {
            return "Processamento concluído. Os dados foram coletados mas não há informações para exibir no momento.";
        }

        return text.trim();
    }

    _levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1 // deletion
                        )
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }
}

export const orchestrator = new AgentOrchestrator();
