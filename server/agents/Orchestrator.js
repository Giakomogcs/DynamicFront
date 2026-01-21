import { toolService } from '../services/toolService.js';
import { mapMcpToolsToAiModels } from '../ToolAdapter.js';

// Agents
import { plannerAgent } from './Planner.js';
import { executorAgent } from './Executor.js';
import { designerAgent } from './Designer.js';

// Phase 1: Context & Auth Intelligence
import { canvasContextAnalyzer } from '../src/core/CanvasContextAnalyzer.js';
import { authStrategyManager } from '../src/auth/AuthStrategyManager.js';

// Phase 2: Strategic Reasoning
import { routerAgent } from './Router.js';

// Phase 2: Strategic Reasoning
import { strategicAgent } from '../src/agents/StrategicAgent.js';
import { templateCache } from '../src/cache/TemplateCache.js';

// Phase 3: Canvas Groups
import { canvasGroupManager } from '../src/canvas/CanvasGroupManager.js';
import { canvasMerger } from '../src/canvas/CanvasMerger.js';

export class AgentOrchestrator {
    constructor() { }

    async processRequest(userMessage, history, modelName = null, location = null, canvasContext = null) {
        console.log(`\n=== [Orchestrator] New Request: "${userMessage?.substring(0, 50)}..." ===`);

        // PHASE 0: ROUTING (New Phase 2)
        // Check if this is a navigation intent before planning tools
        if (canvasContext && canvasContext.sessionId) { // Only route if in a session
            const currentSlug = canvasContext.activeSlug || 'home'; // Ensure App.jsx sends this
            const routing = await routerAgent.analyzeRequest(userMessage, currentSlug, canvasContext.sessionId);
            console.log(`[Orchestrator] Router Intent: ${routing.intent}`);

            if (routing.intent === 'NAVIGATE' && routing.targetSlug) {
                console.log(`[Orchestrator] 🚀 Navigation Intent: ${routing.targetSlug}. Proceeding with execution.`);
                // PHASE 0.5: Simulate being on target page for Planner
                canvasContext = {
                    ...canvasContext,
                    activeSlug: routing.targetSlug,
                    forceNavigationSlug: routing.targetSlug // Store for final action
                };

                // Do NOT return early. Continue to Plan/Execute.
            }

            if (routing.intent === 'CREATE_PAGE') {
                console.log(`[Orchestrator] 🆕 Router suggests creating NEW PAGE: ${routing.pageTitle}`);
                // PHASE 0.5: Set intent to force new page creation AFTER execution
                // We do NOT return early anymore. We want to PLAN and EXECUTE to get data for this new page.
                canvasContext = {
                    ...canvasContext,
                    forceNewPage: true,
                    newPageTitle: routing.pageTitle
                };
            }
        }

        if (canvasContext && canvasContext.sessionId) {
            console.log(`[Orchestrator] 🌐 Fetching Session Context for ${canvasContext.sessionId}...`);
            const sessionContext = await this._getSessionContext(canvasContext.sessionId, canvasContext.canvasId);
            if (sessionContext) {
                canvasContext.siblings = sessionContext;
                console.log(`[Orchestrator] ✅ Found ${sessionContext.length} sibling pages.`);
            }
        }

        if (canvasContext) {
            console.log(`[Orchestrator] Canvas Context: Mode=${canvasContext.mode}, Widgets=${canvasContext.widgets?.length || 0}`);
        }

        // PHASE 1: Analyze existing canvas (if any)
        let canvasAnalysis = null;
        if (canvasContext && canvasContext.widgets && canvasContext.widgets.length > 0) {
            console.log('[Orchestrator] Step 0: Analyzing existing canvas...');
            canvasAnalysis = await canvasContextAnalyzer.analyzeCanvas(canvasContext);
            console.log(`[Orchestrator] Canvas Analysis: Theme="${canvasAnalysis.theme.primary}", Components=${canvasAnalysis.components.length}, Tools Used=${canvasAnalysis.toolsUsed.length}`);
        }

        // 1. Fetch All Tools (Cached)
        // console.log("[Orchestrator] Step 1: Fetching available tools...");
        const allMcpTools = await toolService.getAllTools();
        const allCompatibleTools = mapMcpToolsToAiModels(allMcpTools);
        // console.log(`[Orchestrator] Found ${allMcpTools.length} total tools.`);

        // 1.5 Fetch Resource Context for "What can you do?"
        // const resources = await toolService.getRegisteredResources();
        // const resourceSummary = this._formatResourceSummary(resources);
        const resourceSummary = await toolService.getResourceProfiles();

        // 2. PLAN (with canvas analysis context)
        console.log("[Orchestrator] Step 2: Planning tool usage...");
        // 2. PLAN (with canvas analysis context)
        console.log("[Orchestrator] Step 2: Planning tool usage...");
        const plan = await plannerAgent.plan(userMessage, allMcpTools, location, modelName, history, canvasAnalysis, canvasContext);

        // PERSISTENCE: If Planner switched models (failover), update global modelName
        if (plan.usedModel) {
            console.log(`[Orchestrator] 🔄 Planner used model: ${plan.usedModel}. Persisting for next steps.`);
            modelName = plan.usedModel;
        }

        const selectedToolNames = plan.tools || [];
        console.log(`[Orchestrator] Planner selected: [${selectedToolNames.join(', ')}]`);
        console.log(`[Orchestrator] Strategy: ${plan.thought}`);

        // 🔥 VALIDATE tools exist before proceeding
        let validatedTools = selectedToolNames.filter(name => {
            // Strip prefix if present to match sanitized names
            const sanitizedName = name.includes('__') ? name.split('__').pop() : name;

            const exists = allCompatibleTools.find(t =>
                t.name === name || t.name === sanitizedName
            );

            if (!exists) {
                console.warn(`[Orchestrator] ⚠️ Tool '${name}' doesn't exist. Ignoring.`);
            }
            return exists !== undefined;
        });

        console.log(`[Orchestrator] Validated: ${validatedTools.length}/${selectedToolNames.length} tools exist`);

        // 🔥 AGGRESSIVE FALLBACK: If no valid tools, auto-select based on keywords
        let finalToolNames = validatedTools;
        if (finalToolNames.length === 0) {
            console.log('[Orchestrator] ⚠️ Planner returned EMPTY tools. Auto-selecting based on keywords...');

            const lowerMsg = userMessage.toLowerCase();
            const autoSelected = [];

            // Always try auth first for empresa/senai requests
            if (lowerMsg.includes('empresa') || lowerMsg.includes('minha') || lowerMsg.includes('company')) {
                const authTool = allCompatibleTools.find(t => t.name.includes('auth') && t.name.includes('session'));
                if (authTool) {
                    autoSelected.push(authTool.name);
                    console.log(`[Orchestrator] 🔥 Auto-selected auth: ${authTool.name}`);
                }

                const companyTool = allCompatibleTools.find(t =>
                    t.name.includes('getcompanyprofile') || t.name.includes('listenterprise')
                );
                if (companyTool) {
                    autoSelected.push(companyTool.name);
                    console.log(`[Orchestrator] 🔥 Auto-selected company: ${companyTool.name}`);
                }
            }

            if (lowerMsg.includes('escola') || lowerMsg.includes('senai') || lowerMsg.includes('school')) {
                const schoolTool = allCompatibleTools.find(t => t.name.includes('getshools') || t.name.includes('school'));
                if (schoolTool) {
                    autoSelected.push(schoolTool.name);
                    console.log(`[Orchestrator] 🔥 Auto-selected school: ${schoolTool.name}`);
                }
            }

            if (autoSelected.length > 0) {
                finalToolNames = autoSelected;
                console.log(`[Orchestrator] ✅ Auto-selected ${autoSelected.length} tools as fallback`);
            } else {
                console.warn('[Orchestrator] ❌ Could not auto-select any tools. Returning conversational response.');
            }
        }

        // Filter Tools with Fuzzy Matching
        let activeTools = [];
        const missingTools = [];

        for (const name of finalToolNames) {
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
                    // SEMANTIC CHECK: Always prevent 'list' matching 'get' regardless of similarity
                    // If one contains 'list' and the other contains 'get', they are NOT the same.
                    const actionA = lowerName.includes('list') ? 'list' : (lowerName.includes('get') ? 'get' : 'other');
                    const actionB = tLower.includes('list') ? 'list' : (tLower.includes('get') ? 'get' : 'other');
                    if (actionA !== 'other' && actionB !== 'other' && actionA !== actionB) {
                        return false;
                    }

                    // Heuristic: If one is substring of another
                    if (tLower.includes(lowerName) || lowerName.includes(tLower)) {
                        return true;
                    }

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

        // 3. EXECUTE DIRECTLY (StrategicAgent disabled temporarily)
        console.log(`[Orchestrator] Step 3: Executing with ${activeTools.length} tools DIRECTLY...`);

        // TEMPORARY: Direct execution without retries
        const executionData = await executorAgent.execute(
            userMessage,
            history,
            modelName,
            activeTools,
            { thought: plan.thought, auth_strategy: plan.auth_strategy }, // Pass structured context
            location,
            "" // resourceSummary - not needed
        );

        const executionResult = { success: true, result: executionData, attempts: 1, strategy: plan.thought };

        // Check if strategic execution was successful
        if (!executionResult.success) {
            console.warn(`[Orchestrator] ⚠️ Strategic execution failed after ${executionResult.attempts} attempts`);
            console.warn(`[Orchestrator] Last strategy: ${executionResult.lastStrategy}`);

            // Return fallback response
            return {
                text: executionResult.fallbackMessage || `Não consegui obter dados após ${executionResult.attempts} tentativas.`,
                widgets: [],
                metadata: {
                    strategy: 'failed',
                    attempts: executionResult.attempts,
                    adaptations: executionResult.adaptations
                }
            };
        }

        console.log(`[Orchestrator] ✅ Strategic execution successful on attempt ${executionResult.attempts}`);
        console.log(`[Orchestrator] Strategy used: ${executionResult.strategy}`);

        // PERSISTENCE: If Executor switched models (failover), update global modelName
        if (executionResult.result?.usedModel) {
            console.log(`[Orchestrator] 🔄 Executor used model: ${executionResult.result.usedModel}. Persisting for next steps.`);
            modelName = executionResult.result.usedModel;
        }

        console.log("[Orchestrator] Execution finished. Gathering result...");

        // 3.5. CANVAS DECISION (Phase 3): Merge or Create?
        console.log("[Orchestrator] Step 3.5: Analyzing canvas decision (merge vs create)...");

        let canvasDecision = null;

        // CHECK ROUTING INTENT (New Phase 3 Logic)
        if (canvasContext && canvasContext.forceNewPage) {
            console.log(`[Orchestrator] 🆕 Forced New Page: ${canvasContext.newPageTitle}`);
            canvasDecision = {
                action: 'create',
                title: canvasContext.newPageTitle,
                reason: 'router_create_page_intent'
            };
        } else if (canvasContext && canvasContext.sessionId) {
            const currentSlug = canvasContext.activeSlug || 'home';
            // Simplification: If we are in Intelligent Mode and have an active canvas, 
            // and the user didn't ask for a new page (CREATE_PAGE was handled up top),
            // then we FORCE MERGE to the current canvas ID.

            console.log(`[Orchestrator] 🧠 Smart Context: Preserving current canvas ${canvasContext.canvasId}`);
            canvasDecision = {
                action: 'merge',
                targetCanvasId: canvasContext.canvasId,
                reason: 'router_update_current_intent'
            };
        } else {
            // Fallback to legacy Theme-Based Decision
            try {
                canvasDecision = await canvasGroupManager.decideCanvasAction(
                    userMessage,
                    { primary: 'General' },
                    canvasContext ? [canvasContext] : []
                );

                console.log(`[Orchestrator] Canvas Decision: ${canvasDecision?.action?.toUpperCase()}`);
            } catch (error) {
                console.warn(`[Orchestrator] Canvas decision failed: ${error.message}, defaulting to create`);
                canvasDecision = { action: 'create', theme: { primary: 'General' }, reason: 'error_recovery' };
            }
        }

        // 4. DESIGN
        // Pass Plan Strategy/Steps to Designer for better visualization
        console.log("[Orchestrator] Step 4: Designing output widgets...");

        try {
            // Extract correct data from strategic execution result
            const executionData = executionResult.result || executionResult;

            const finalResult = await designerAgent.design(
                executionData.text || 'Processamento concluído',
                executionData.gatheredData || [],
                modelName,
                plan.steps, // Execution steps
                canvasContext, // Canvas context for incremental mode
                canvasDecision // NEW: Pass canvas decision to Designer
            );
            console.log("=== [Orchestrator] Process Complete ===\n");

            // 5. SERVER-SIDE PERSISTENCE (Robustness)
            console.log("[Orchestrator] Step 5: Persisting results to database...");

            let targetCanvasId = canvasContext?.canvasId;
            let targetTitle = null;
            let isNewPage = false;
            let targetSlug = null;

            // Determine Target Canvas
            if (canvasContext && canvasContext.forceNewPage) {
                isNewPage = true;
                targetTitle = canvasDecision.title || "New Page";
                // Generate new ID for the new page
                targetCanvasId = crypto.randomUUID();
            } else if (canvasContext && canvasContext.forceNavigationSlug) {
                // We need to resolve slug to ID to save reliably, or let saveCanvas handle it if we pass null ID? 
                // Actually saveCanvas needs ID to upsert.
                // We need to Find the canvas by slug first if we don't have ID.
                // But typically forceNavigationSlug comes with a known target if from Router? 
                // Router only gives slug.
                const { storageService } = await import('../services/storageService.js');
                const sessionStruct = await storageService.getSessionStructure(canvasContext.sessionId);
                const existing = sessionStruct?.canvases?.find(c => c.slug === canvasContext.forceNavigationSlug);
                if (existing) {
                    targetCanvasId = existing.id;
                    targetTitle = existing.title;
                    targetSlug = existing.slug;
                } else {
                    console.warn(`[Orchestrator] Target slug ${canvasContext.forceNavigationSlug} not found. Cannot persist to it.`);
                    // Fallback to current? Or Create?
                }
            }

            // Perform Persistence
            const savedCanvas = await this._persistExecutionResult(
                targetCanvasId,
                canvasContext?.sessionId,
                targetTitle,
                finalResult.widgets,
                userMessage,
                finalResult.text,
                history // Pass full history if we want to append? Or just new message?
            );

            // Construct Final Response
            if (isNewPage && savedCanvas) {
                return {
                    text: finalResult.text,
                    action: 'navigate_canvas',
                    targetSlug: savedCanvas.slug,
                    widgets: [], // Client expects to load them from nav
                    metadata: {
                        action: 'navigate_canvas',
                        targetSlug: savedCanvas.slug,
                        isNewPage: true
                    }
                };
            }

            if (canvasContext && canvasContext.forceNavigationSlug && savedCanvas) {
                return {
                    ...finalResult,
                    action: 'navigate_canvas',
                    targetSlug: savedCanvas.slug,
                    metadata: {
                        ...finalResult.metadata,
                        action: 'navigate_canvas',
                        targetSlug: savedCanvas.slug
                    }
                };
            }

            return finalResult;
        } catch (designError) {
            console.error("[Orchestrator] Designer failed:", designError.message);

            // FALLBACK: Return sanitized text response
            console.log("=== [Orchestrator] Process Complete (with fallback) ===\n");
            return {
                text: this._sanitizeResponse(executionResult.result?.text),
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
        // ... (existing levenshtein implementation)
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

    _formatResourceSummary(resources) {
        if (!resources || (!resources.apis?.length && !resources.dbs?.length)) {
            return "No external resources connected yet.";
        }

        let summary = [];
        if (resources.apis?.length) {
            summary.push(`- APIs: ${resources.apis.map(a => `${a.name} (${a.baseUrl})`).join(', ')} `);
        }
        if (resources.dbs?.length) {
            summary.push(`- Databases: ${resources.dbs.map(d => `${d.name} (${d.type})`).join(', ')} `);
        }
        return summary.join('\\n');
    }
    async _persistExecutionResult(canvasId, sessionId, title, widgets, userMessage, aiResponseText, history) {
        if (!canvasId) {
            console.warn("[Orchestrator] Persist skipped: No canvasId provided.");
            return null;
        }

        try {
            console.log(`[Orchestrator] 💾 Persisting to Canvas ${canvasId}...`);
            const { storageService } = await import('../services/storageService.js');

            // Get existing canvas to append chat?
            // Actually storageService.saveCanvas handles full widget replacement. 
            // For messages, we usually want to append.
            const existing = await storageService.getCanvas(canvasId);

            let messages = existing ? (existing.messages || []) : [];

            // Append User + AI Turn
            // If historical messages are passed, maybe filtering? 
            // Orchestrator usually receives "history" but that's what was sent TO the model.
            // We want to save the NEW interaction.

            if (userMessage) messages.push({ role: 'user', text: userMessage });
            if (aiResponseText) messages.push({ role: 'model', text: aiResponseText });

            // Ensure widgets are not empty if we just designed them?
            // If widgets is [], it might mean "no change" or "empty". 
            // Designer might return gathered Data without widgets?
            // No, designerAgent.design always returns widgets array (maybe empty).
            // If empty, should we KEEP existing?
            // Usually Designer returns the FULL set of widgets for the canvas (merged).
            // So we can overwrite safely.

            const saved = await storageService.saveCanvas(
                canvasId,
                title || existing?.title, // Keep title if not providing new one
                widgets,
                messages,
                sessionId
            );

            console.log(`[Orchestrator] ✅ Persistence complete. Slug: ${saved?.slug}`);
            return saved;

        } catch (e) {
            console.error("[Orchestrator] ❌ Persistence Failed:", e);
            // Don't block response, just log.
            return null;
        }
    }

    async _getSessionContext(sessionId, currentCanvasId) {
        try {
            const { storageService } = await import('../services/storageService.js');
            const structure = await storageService.getSessionStructure(sessionId);
            if (!structure || !structure.canvases) return [];

            // Filter out current canvas if needed, or keep it to show "current status"
            // Let's keep it but mark it? No, usually siblings implies "other" pages.
            // But contextually, knowing what the current page is called is also good.
            // Let's return all.
            return structure.canvases.map(c => ({
                id: c.id,
                title: c.title,
                slug: c.slug,
                isCurrent: c.id === currentCanvasId,
                widgetCount: c._count?.widgets || 0 // access prisma _count if available, or just ignore
            }));
        } catch (e) {
            console.warn("[Orchestrator] Failed to load session context:", e.message);
            return [];
        }
    }
}

export const orchestrator = new AgentOrchestrator();
