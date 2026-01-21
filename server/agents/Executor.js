/**
 * Executor Agent
 * Executes tool calls with proper authentication
 */
import { modelManager } from '../services/ai/ModelManager.js';
import fs from 'fs';
import { toolService } from '../services/toolService.js';
import { resourceEnricher } from '../src/core/ResourceEnricher.js';
import { NoProfilesAvailableError } from '../src/errors/AuthErrors.js';
import { getOriginalToolName } from '../ToolAdapter.js';

export class ExecutorAgent {
    constructor() {
        this.resourceEnricher = resourceEnricher;
    }

    /**
     * Executes the chat loop with the selected tools.
     * @param {string} userMessage 
     * @param {Array} history 
     * @param {string} modelName 
     * @param {Array} tools - Gemini formatted tools (TODO: standard format?)
     * @returns {Promise<{text: string, gatheredData: Array}>}
     */
    /**
     * Executes the chat loop with the selected tools.
     * @param {string} userMessage 
     * @param {Array} history 
     * @param {string} modelName 
     * @param {Array} tools - Gemini formatted tools (TODO: standard format?)
     * @param {string} planContext 
     * @param {Object} location - { lat, lon }
     * @returns {Promise<{text: string, gatheredData: Array}>}
     */
    async execute(userMessage, history, modelName, tools, enhancedContext, location = null, resourceSummary = null) {
        console.log(`[Executor] Starting execution with ${tools.length} tools. Model: ${modelName}`);

        // 0. Parse Enhanced Context (Plan + Auth)
        let planThought = "Use the available tools to answer the user request.";
        let plannerAuthStrategy = null;

        if (enhancedContext) {
            if (typeof enhancedContext === 'object') {
                planThought = enhancedContext.thought;
                plannerAuthStrategy = enhancedContext.auth_strategy;
            } else {
                planThought = enhancedContext;
            }
        }

        // SMART AUTO-AUTHENTICATION
        // Priority: 1. Planner Strategy (Explicit) -> 2. Executor Detection (Implicit)
        let authContext = null;

        if (plannerAuthStrategy && plannerAuthStrategy.email) {
            console.log(`[Executor] 🔐 Planner enforced Auth Strategy: Using ${plannerAuthStrategy.email}`);

            // NEW: Fetch complete profile from ResourceEnricher instead of creating empty one
            const allProfiles = this.resourceEnricher.getAllProfiles();
            let matchingProfile = allProfiles.find(p =>
                p.credentials?.email === plannerAuthStrategy.email ||
                p.credentials?.user === plannerAuthStrategy.email
            );

            // ROBUST FALLBACK: If Planner hallucinated an email (e.g. random admin@...), find a REAL admin profile
            if (!matchingProfile) {
                console.warn(`[Executor] ⚠️ Planner email '${plannerAuthStrategy.email}' not found. Searching for valid fallback profile...`);

                // 1. Try to find a profile with the same Role if listed in strategy (not currently passed, but implied)
                // 2. Fallback to any 'admin' profile if the strategy implies admin
                if (plannerAuthStrategy.email && (plannerAuthStrategy.email.includes('admin') || plannerAuthStrategy.reason?.toLowerCase().includes('admin'))) {
                    matchingProfile = allProfiles.find(p => p.role.toLowerCase().includes('admin') || p.label.toLowerCase().includes('admin'));
                    if (matchingProfile) {
                        console.log(`[Executor] 🔄 Fallback: Found valid ADMIN profile '${matchingProfile.label}' needed for request.`);
                    }
                }

                // 3. Fallback to the first available profile if still nothing (better than nothing)
                if (!matchingProfile && allProfiles.length > 0) {
                    matchingProfile = allProfiles[0];
                    console.log(`[Executor] 🔄 Fallback: Using first available profile '${matchingProfile.label}' as last resort.`);
                }
            }

            if (matchingProfile) {
                console.log(`[Executor] ✅ Found matching profile: ${matchingProfile.label}`);
                authContext = {
                    context: "Planner Strategic Auth",
                    profile: matchingProfile,
                    profiles: [matchingProfile]
                };
            } else {
                console.warn(`[Executor] ⚠️ Profile not found for ${plannerAuthStrategy.email}, falling back to detection`);
                authContext = await this._detectAuthContext(userMessage, history);
            }
        } else {
            authContext = await this._detectAuthContext(userMessage, history);
        }
        const authInstruction = authContext ? `
🔐 AUTO-AUTHENTICATION ENABLED:
Context detected: ${authContext.context}
${authContext.profiles ? authContext.profiles.map(p =>
            `- ${p.label} (${p.role}): ${JSON.stringify(p.credentials)}`
        ).join('\n') : `Use profile: ${authContext.profile.label}\nCredentials: ${JSON.stringify(authContext.profile.credentials)}`}

CRITICAL MULTI-AUTH RULES:
1. If request needs BOTH company AND school data, authenticate with BOTH profiles
2. Use company profile for: getCompanyProfile, listEnterprise
3. Use senai_admin profile for: getSchools, dashboards  
4. Execute tools with appropriate profile automatically
5. DO NOT ask user for credentials - use profiles above
` : '';

        // 1. Prepare Initial Messages (Stateless)
        const messages = this.prepareHistory(history);

        let finalUserMessage = userMessage;

        const safeToolNames = tools.map(t => t.name).join(', ');
        const systemInstruction = `You are a helpful assistant designed to help the user organize and visualize data from their connected resources.
            
            CONNECTED RESOURCES:
            ${resourceSummary}

            TOOLS: [${safeToolNames}]

            EXECUTION PLAN (STRATEGY):
            ${planThought || "Use the available tools to answer the user request."}
            
            Instructions:
            1. **MANDATORY**: You MUST follow the EXECUTION PLAN above.
            2. **UI PRIORITY**: If 'manage_pages' is available, CALL IT FIRST to establish the visual context. Do not wait for data to build the page.
            3. **DO NOT** just answer comfortably. You must CALL THE TOOLS to get the real data.
            4. If the plan says to "Call Tool X", you MUST return a Function Call for Tool X.
            5. If you lack credentials for a data tool, explain this in the text response, BUT DO NOT BLOCK the 'manage_pages' call.
            6. Return a Function Call object to invoke a tool.
            7. **STRICTLY FORBIDDEN**: Do NOT output code blocks, python scripts, TODO lists, or "placeholder" implementations. You are an Agent, not a Code Editor. If you cannot do it with tools, say you cannot.
            8. If you cannot execute a tool, return a text explanation but still TRY to execute 'manage_pages' if relevant.
        `;

        let gatheredData = [];
        let finalResponseText = "";
        let turn = 0;
        const maxTurns = 5;
        let effectiveModel = modelName;

        try {
            while (turn < maxTurns) {
                turn++;

                // CALL AI
                const result = await modelManager.generateContentWithFailover(messages, {
                    model: modelName,
                    tools: tools,
                    systemInstruction
                });

                // Update effective model if failover occurred
                if (result.usedModel) {
                    effectiveModel = result.usedModel;
                    modelName = result.usedModel;
                }

                // Parse Result
                const response = result.response;
                const text = response.text() || "";
                const toolCalls = response.functionCalls ? response.functionCalls() : [];
                const knownToolNames = tools.map(t => t.name);

                finalResponseText = text;

                // FALLBACK: Manual Parsing (Llama/XML/Json/Text)
                if (toolCalls.length === 0 && text) {
                    console.log(`[Executor] ℹ️ No native function calls. Attempting manual parsing of raw text: "${text.substring(0, 100)}..."`);

                    // Strategy A: Try parsing the whole text as a JSON Tool Call
                    try {
                        const json = JSON.parse(text);
                        if (json.name && knownToolNames.includes(json.name)) {
                            toolCalls.push({ name: json.name, args: json.parameters || json.args || {} });
                        } else if (Array.isArray(json) && json.length >= 1 && knownToolNames.includes(json[0])) {
                            let args = json[1] || {};
                            if (typeof args === 'string') {
                                if (json[0].includes('query')) args = { sql: args };
                                else if (json[0].includes('inspect')) args = { search: args };
                            }
                            toolCalls.push({ name: json[0], args: args });
                        }
                    } catch (e) { }

                    // Strategy B: XML-style
                    if (toolCalls.length === 0) {
                        // Regex 1: <function>name</function>(args) OR just <function>name</function>
                        const xmlRegex1 = /<function>([^<]+)<\/function>(\s*\(([^)]*)\))?/i;
                        const xmlRegex2 = /<function=([^>]+)>([\s\S]*?)<\/function>/i; // Adjusted to capture multiline content
                        const match1 = text.match(xmlRegex1);
                        const match2 = text.match(xmlRegex2);

                        if (match1) {
                            const tName = match1[1];
                            if (knownToolNames.includes(tName)) {
                                let args = {};
                                if (match1[3]) {
                                    try { args = JSON.parse(match1[3]); } catch (e) { args = { value: match1[3] }; }
                                }
                                toolCalls.push({ name: tName, args });
                                // Remove from visible text
                                finalResponseText = finalResponseText.replace(match1[0], '').trim();
                            }
                        } else if (match2) {
                            const tName = match2[1];
                            if (knownToolNames.includes(tName)) {
                                let argsString = match2[2];
                                let args = {};
                                try { args = JSON.parse(argsString); } catch (e) { args = { value: argsString }; }
                                toolCalls.push({ name: tName, args });
                                // Remove from visible text
                                finalResponseText = finalResponseText.replace(match2[0], '').trim();
                            }
                        }
                    }

                    // Strategy C: Regex Match tool_name(args)
                    if (toolCalls.length === 0) {
                        for (const toolName of knownToolNames) {
                            if (text.includes(toolName)) {
                                const regex = new RegExp(`${toolName}\\s*\\(([^)]*)\\)`, 'i');
                                const match = text.match(regex);
                                if (match) {
                                    console.log(`[Executor] 🛠️ Detected text-based tool call for '${toolName}'. Parsing...`);
                                    let argsString = match[1].trim();
                                    let args = {};
                                    try {
                                        // 1. Try strict JSON first
                                        if (argsString.startsWith('{')) {
                                            args = JSON.parse(argsString);
                                        } else {
                                            // 2. Python-style / Text-style Args
                                            // Heuristic A: Key-Value pairs
                                            const kvRegexComplex = /(\w+)=(["'])(.*?)\2/g;
                                            const kvRegexUnquoted = /(\w+)=([-]?\w+\.?\w*)/g;

                                            let hasKv = false;
                                            let kvMatch;

                                            while ((kvMatch = kvRegexComplex.exec(argsString)) !== null) {
                                                args[kvMatch[1]] = kvMatch[3];
                                                hasKv = true;
                                            }

                                            const unquotedMatches = [...argsString.matchAll(kvRegexUnquoted)];
                                            for (const m of unquotedMatches) {
                                                const key = m[1];
                                                let val = m[2];
                                                if (!isNaN(Number(val))) val = Number(val);
                                                else if (val.toLowerCase() === 'true') val = true;
                                                else if (val.toLowerCase() === 'false') val = false;
                                                else if (val.toLowerCase() === 'null') val = null;

                                                if (!args[key]) {
                                                    args[key] = val;
                                                    hasKv = true;
                                                }
                                            }

                                            if (!hasKv) {
                                                // Heuristic B: Single Argument Fallback
                                                // If the tool call is tool_name(value) with no kv, map it to the first likely parameter
                                                // TODO: Retrieve actual schema key. For now, we fix specific known issues.
                                                const rawVal = argsString.replace(/^["']|["']$/g, '');
                                                if (toolName.includes('query')) args = { sql: rawVal };
                                                else if (toolName.includes('search')) args = { schoolsCnpj: [rawVal] }; // Specific fix for current issue!
                                                else if (toolName.includes('getsenaiunits')) args = { city: rawVal };
                                                else args = { search: rawVal, value: rawVal };

                                                console.log(`[Executor] ⚠️ Mapping single arg '${rawVal}' for '${toolName}' via Heuristic.`);
                                            }
                                        }
                                    } catch (e2) {
                                        console.warn(`[Executor] Parsing failed for ${toolName}. Error: ${e2.message}`);
                                        continue;
                                    }
                                    toolCalls.push({
                                        name: toolName,
                                        args: args
                                    });
                                    // Remove from visible text
                                    finalResponseText = finalResponseText.replace(match[0], '').trim();
                                }
                            }
                        }
                    }
                }

                if (toolCalls.length > 0) {
                    // For Gemini, we push the tool calls as the model response
                    messages.push({
                        role: 'model',
                        content: text, // might be empty
                        toolCalls: toolCalls // Pass explicitly for mapping
                    });

                    // Execute Tools
                    for (const call of toolCalls) {
                        // FIX: Map sanitized name back to original MCP name
                        const originalName = getOriginalToolName(call.name);
                        if (originalName !== call.name) {
                            console.log(`[Executor] 🔄 Mapping sanitized name '${call.name}' back to '${originalName}'`);
                            call.name = originalName;
                        }

                        console.log(`[Executor] >>> Calling Tool: ${call.name}`);

                        // Apply intelligent filters BEFORE execution
                        const filteredArgs = this.applyIntelligentFilters(call.name, call.args, userMessage, tools, location, authContext);

                        // ✨ PRE-VALIDATION: Check if required params are present
                        const validation = this._validateToolParams(call.name, filteredArgs, tools);
                        if (!validation.valid) {
                            console.log(`[Executor] ⚠️ Tool params invalid: ${validation.reason}`);

                            // Return structured error that StrategicAgent can understand
                            toolResult = {
                                isError: true,
                                content: [{
                                    text: JSON.stringify({
                                        error: 'MISSING_REQUIRED_PARAMS',
                                        missing: validation.missing,
                                        suggestion: validation.suggestion,
                                        tool: call.name
                                    })
                                }]
                            };

                            // Add to gathered data and continue
                            gatheredData.push({ tool: call.name, result: toolResult });
                            messages.push({
                                role: 'tool',
                                name: call.name,
                                content: toolResult.content
                            });

                            continue; // Skip actual execution
                        }

                        // SMART CONTEXT INJECTION (Accumulator)
                        // If we have previous context for this tool's parameters, inject it if missing
                        if (this.contextAccumulator) {
                            // Inject Schools CNPJ (List)
                            if (filteredArgs.schoolsCnpj === undefined && this.contextAccumulator.schoolsCnpj && toolName.includes('courses')) {
                                filteredArgs.schoolsCnpj = this.contextAccumulator.schoolsCnpj;
                                console.log(`[Executor] 🧠 Injecting Context: schoolsCnpj = ${JSON.stringify(filteredArgs.schoolsCnpj)}`);
                            }
                            // Inject Course ID (Single)
                            if ((filteredArgs.courseId === undefined || filteredArgs.courseId === "") && this.contextAccumulator.courseId) {
                                // Check if tool likely needs an ID (has 'details' or 'get' in name)
                                if (toolName.includes('details') || toolName.includes('getcourse')) {
                                    filteredArgs.courseId = this.contextAccumulator.courseId;
                                    console.log(`[Executor] 🧠 Injecting Context: courseId = ${filteredArgs.courseId}`);
                                }
                            }
                        }

                        let toolResult;
                        try {
                            toolResult = await toolService.executeTool(call.name, filteredArgs);

                            // 🔥 EXTRACT CONTEXT from AUTH responses & UPDATE PROFILE
                            if (!toolResult.isError && toolResult.content && (call.name.includes('auth') || call.name.includes('login') || call.name.includes('session'))) {
                                try {
                                    const authText = toolResult.content[0]?.text;
                                    if (authText) {
                                        const authData = JSON.parse(authText);

                                        // 1. Update Context Accumulator (Runtime)
                                        this.contextAccumulator = this.contextAccumulator || {};
                                        if (authData.cnpj) this.contextAccumulator.companyCnpj = authData.cnpj;
                                        if (authData.name) this.contextAccumulator.companyName = authData.name;
                                        if (authData.id) this.contextAccumulator.companyId = authData.id;
                                        if (authData.token) this.contextAccumulator.authToken = authData.token;

                                        console.log(`[Executor] 🧠 Extracted from auth: CNPJ=${authData.cnpj || 'N/A'}, Name=${authData.name || 'N/A'}`);

                                        // 2. DYNAMIC PROFILE UPDATE (Persistence)
                                        // Find which profile was used for this call
                                        let usedEmail = filteredArgs.email || filteredArgs.user;
                                        if (usedEmail) {
                                            const profiles = this.resourceEnricher.getAllProfiles();
                                            const usedProfile = profiles.find(p => p.credentials?.email === usedEmail || p.credentials?.user === usedEmail);

                                            if (usedProfile) {
                                                console.log(`[Executor] 💾 Updating Auth Profile '${usedProfile.label}' with new data...`);

                                                // Merge new data into credentials
                                                const newCredentials = { ...usedProfile.credentials };
                                                const updates = {};
                                                let hasUpdates = false;

                                                // 1. Credentials Updates (Generic/Dynamic)
                                                // User requested to save EVERYTHING ("pode salvar tudo") because different resources return different data.
                                                // We merge ALL fields from authData into credentials.
                                                Object.entries(authData).forEach(([key, value]) => {
                                                    // Skip complex objects if needed, or unnecessary fields like 'message' or 'statusCode' if they exist?
                                                    // Assuming authData is the "user" object or "session" object returned.
                                                    // We'll skip standard HTTP response fields if they leak in, but usually tool result text is the data payload.
                                                    if (key !== 'message' && key !== 'statusCode' && key !== 'error') {
                                                        if (JSON.stringify(newCredentials[key]) !== JSON.stringify(value)) {
                                                            newCredentials[key] = value;
                                                            hasUpdates = true;
                                                        }
                                                    }
                                                });

                                                if (hasUpdates) {
                                                    updates.credentials = newCredentials;
                                                }

                                                // 2. Core Profile Updates (Role, Label/Name)
                                                // Update Label (Name in UI)
                                                if (authData.name && usedProfile.label !== authData.name) {
                                                    updates.label = authData.name;
                                                    hasUpdates = true;
                                                }
                                                // Update Role if provided and different
                                                if (authData.role && usedProfile.role !== authData.role) {
                                                    updates.role = authData.role;
                                                    hasUpdates = true;
                                                }

                                                if (hasUpdates) {
                                                    await this.resourceEnricher.updateProfile(usedProfile.resourceId, usedProfile.id, updates);
                                                    console.log(`[Executor] ✅ Auth Profile Updated in DB (Label, Role, or Creds changed).`);
                                                } else {
                                                    console.log(`[Executor] No new data to update in profile.`);
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`[Executor] Failed to process auth response for profile update: ${e.message}`);
                                }
                            }

                            // EXTRACT ENTITIES for future context (Generic Entity Recognition)
                            if (toolResult && !toolResult.isError && toolResult.content) {
                                this.extractContextEntities(toolResult.content);
                            }

                            // 5.1. AUTO-RETRY: Schools Not Found -> Fallback to Hub (São Paulo)
                            // If user is in a location with no schools, we must find *some* schools to allow course search to proceed.
                            if (call.name.includes('schoolscontroller_getshools')) {
                                const resultStr = JSON.stringify(toolResult.content);
                                let isEmpty = false;
                                try {
                                    const parsed = JSON.parse(toolResult.content[0].text);
                                    const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
                                    if (list.length === 0) isEmpty = true;
                                } catch (e) {
                                    if (resultStr.includes('"length":0') || resultStr.includes('[]')) isEmpty = true;
                                }

                                if (isEmpty && !filteredArgs._isFallback) { // Prevent infinite loop
                                    console.log(`[Executor] 🔄 Auto-Retry: No schools found at current location. Retrying with HUB Location (São Paulo) to ensure data...`);

                                    // Create fallback args: Clear lat/lon/user location, force SP
                                    const retryArgs = {
                                        ...filteredArgs,
                                        city: "São Paulo",
                                        state: "SP",
                                        _isFallback: true
                                    };
                                    delete retryArgs.lat;
                                    delete retryArgs.lon;
                                    delete retryArgs.latitude;
                                    delete retryArgs.longitude;
                                    delete retryArgs.userLat;
                                    delete retryArgs.userLng;

                                    try {
                                        // Execute Retry
                                        toolResult = await toolService.executeTool(call.name, retryArgs);
                                        console.log(`[Executor] ✅ Auto-Retry (Hub) SUCCESS. Found schools in São Paulo.`);

                                        // Update the args in the "call" object so downstream tools (context accumulators) use the NEW location data if needed? 
                                        // Actually better to just accept this result.

                                        // Update history to show we found something
                                        messages.push({
                                            role: 'tool',
                                            name: call.name,
                                            content: this.compressResult(toolResult, 5)
                                        });
                                        gatheredData.push({ tool: call.name, result: this.compressResult(toolResult, 15) });
                                        continue; // Skip standard processing
                                    } catch (retryErr) {
                                        console.warn(`[Executor] Hub fallback failed: ${retryErr.message}`);
                                    }
                                }
                            }

                            // SELF-CORRECTION: Check if tool was not found (Hallucination prevention)
                            if (toolResult && toolResult.isError && toolResult.content && toolResult.content[0].text.includes('not found')) {
                                const validToolNames = tools.map(t => t.name).join(', ');
                                console.warn(`[Executor] ⚠️ Hallucination detected: '${call.name}'. Triggering Self-Correction.`);

                                // Override error with GUIDANCE
                                toolResult.content[0].text = `[SYSTEM ERROR]: Tool '${call.name}' does not exist. You are HALLUCINATING generic tools. You MUST use one of the following available tools: [${validToolNames}]. Retry now using the correct tool name.`;
                            }
                            // DATA ROBUSTNESS: Check for empty results and suggest retries
                            else if (toolResult && !toolResult.isError) {
                                const resultStr = JSON.stringify(toolResult.content);
                                // Simple heuristic: length of result is small or explicit "empty"/"no results"
                                if (resultStr.length < 50 || resultStr.includes('"length":0') || resultStr.includes('[]')) {
                                    const argValues = Object.values(call.args).filter(v => typeof v === 'string');
                                    if (argValues.length > 0) {
                                        console.log(`[Executor] 🔄 Empty result detected. Suggesting normalization retry for: ${argValues.join(', ')}`);
                                        toolResult.content.push({
                                            type: "text",
                                            text: `\n[SYSTEM HINT]: The search returned NO results for "${argValues.join(', ')}". \n1. Try REMOVING accents (e.g. "São Paulo" -> "Sao Paulo").\n2. Try UPPERCASE or lowercase.\n3. Try a broader search term.\n\n[AUTH HINT]: If this tool requires login, ensure you have called the authentication tool first. If you suspect missing privileges, report this to the user.`
                                        });
                                    }
                                } else {
                                }
                            }

                        } catch (e) {
                            console.error(`[Executor] Tool Error (${call.name}):`, e);
                            toolResult = { isError: true, content: [{ text: `Error: ${e.message}` }] };
                        }


                        // const uiResult = this.compressResult(toolResult, 15); // Removed duplicate
                        const uiResult = this.compressResult(toolResult, 15); // Efficient limit for UI (was 50)

                        // AUTO-RETRY LOGIC 1: Recommended Courses (Broad Search)
                        if (call.name.includes('recommendedcourses') && (!uiResult.content[0].text.includes('id') && !uiResult.content[0].text.includes('courseId'))) {
                            let isEmpty = false;
                            try {
                                const parseCheck = JSON.parse(uiResult.content[0].text);
                                const listCheck = Array.isArray(parseCheck) ? parseCheck : (parseCheck.items || parseCheck.data);
                                if (!listCheck || listCheck.length === 0) isEmpty = true;
                            } catch (e) {
                                if (uiResult.content[0].text.length < 50) isEmpty = true;
                            }

                            if (isEmpty && (filteredArgs.isRecommended === true || filteredArgs.isRecommended === undefined)) {
                                console.log(`[Executor] 🔄 Auto-Retry: Found 0 recommended courses. Retrying with isRecommended=false (Broad Search)...`);
                                const retryArgs = { ...filteredArgs, isRecommended: false };

                                try {
                                    toolResult = await toolService.executeTool(call.name, retryArgs); // FIX: Use toolService, not executeApiTool
                                    const retryUiResult = this.compressResult(toolResult, 15);
                                    const retryParse = JSON.parse(retryUiResult.content[0].text);
                                    const retryList = Array.isArray(retryParse) ? retryParse : (retryParse.items || retryParse.data);
                                    if (retryList && retryList.length > 0) {
                                        console.log(`[Executor] ✅ Auto-Retry SUCCESS: Found ${retryList.length} courses in broad search.`);
                                        gatheredData.push({ tool: call.name, result: retryUiResult });
                                        messages.push({ role: 'tool', name: call.name, content: this.compressResult(toolResult, 5) });
                                        continue;
                                    }
                                } catch (retryError) {
                                    console.warn(`[Executor] Auto-retry failed: ${retryError.message}`);
                                }
                            }
                        }

                        // AUTO-RETRY LOGIC 2: Enterprise Search (Broadening & Refinement)
                        if (call.name.includes('enterprisecontroller_listenterprise')) {
                            let isEmpty = false;
                            try {
                                const parseCheck = JSON.parse(uiResult.content[0].text);
                                const listCheck = Array.isArray(parseCheck) ? parseCheck : (parseCheck.items || parseCheck.data);
                                if (!listCheck || listCheck.length === 0) isEmpty = true;
                            } catch (e) {
                                if (uiResult.content[0].text.length < 50) isEmpty = true;
                            }

                            if (isEmpty) {
                                // Strategy A: Simplify Name (e.g. "Selco Industria" -> "Selco")
                                const currentSearch = filteredArgs.search_bar || "";
                                const words = currentSearch.trim().split(/\s+/);

                                if (words.length > 1) {
                                    const broadTerm = words[0]; // Try just the first word
                                    console.log(`[Executor] 🔄 Auto-Retry: Company not found. Retrying with BROADER term: "${broadTerm}"`);

                                    const retryArgs = { ...filteredArgs, search_bar: broadTerm };
                                    try {
                                        const retryResult = await toolService.executeTool(call.name, retryArgs);
                                        const retryUiResult = this.compressResult(retryResult, 15);
                                        const check = JSON.parse(retryUiResult.content[0].text);
                                        const list = Array.isArray(check) ? check : (check.items || check.data);

                                        if (list && list.length > 0) {
                                            console.log(`[Executor] ✅ Auto-Retry SUCCESS: Found ${list.length} companies with "${broadTerm}".`);
                                            // Sort by location if possible (Sagaz) - already implicit in data return usually? No, we must sort in frontend or here.
                                            // For now, just return the data.
                                            gatheredData.push({ tool: call.name, result: retryUiResult });
                                            messages.push({ role: 'tool', name: call.name, content: this.compressResult(retryResult, 5) });
                                            toolResult = retryResult; // Update reference for fallback history push
                                            continue;
                                        }
                                    } catch (e) { console.warn("Retry A failed", e); }
                                }

                                // Strategy B: Fallback State (if not SP and no location given, maybe try SP?)
                                // Only if Strategy A failed or wasn't applicable.
                                if (filteredArgs.state && filteredArgs.state !== 'SP') {
                                    console.log(`[Executor] 🔄 Auto-Retry: Trying in SP (Hub) as fallback...`);
                                    const retryArgs = { ...filteredArgs, state: 'SP' };
                                    try {
                                        const retryResult = await toolService.executeTool(call.name, retryArgs);
                                        const retryUiResult = this.compressResult(retryResult, 15);
                                        const check = JSON.parse(retryUiResult.content[0].text);
                                        const list = Array.isArray(check) ? check : (check.items || check.data);

                                        if (list && list.length > 0) {
                                            console.log(`[Executor] ✅ Auto-Retry SUCCESS: Found companies in SP.`);
                                            gatheredData.push({ tool: call.name, result: retryUiResult });
                                            messages.push({ role: 'tool', name: call.name, content: this.compressResult(retryResult, 5) });
                                            continue;
                                        }
                                    } catch (e) { console.warn("Retry B failed", e); }
                                }
                            }
                        }

                        // Standard Push (if retry didn't happen or didn't supersede)
                        gatheredData.push({ tool: call.name, result: uiResult });

                        const historyContent = this.compressResult(toolResult, 5); // Strict limit for Context

                        // Append Tool Output to History
                        messages.push({
                            role: 'tool',
                            name: call.name,
                            content: historyContent
                        });
                    }
                } else {
                    break;
                }
            } // end while
        } catch (error) {
            console.error("[Executor] Error in execution loop:", error);
            fs.writeFileSync('debug_executor.log', `[${new Date().toISOString()}] Error: ${error.message}\n${error.stack}\n`);

            if (error.message.includes('429') || error.message.includes('Quota') || error.message.includes('Too Many Requests')) {
                finalResponseText = `⚠️ **System Limit Reached**: The AI model is currently overloaded. Please try again later or switch models.`;
            } else {
                finalResponseText = `I encountered an error processing your request: ${error.message}`;
            }
        }

        return { text: finalResponseText, gatheredData, usedModel: effectiveModel };
    }

    /**
     * Prepares the history for the AI model.
     * @param {Array} history
     * @returns {Array}
     */


    prepareHistory(history) {
        // Map frontend history to generic {role, content}
        let validHistory = (history || []).map(h => ({
            role: h.role === 'assistant' ? 'model' : h.role,
            content: h.text || ""
        })).slice(-10);

        // Ensure first is user (Gemini requirement often, but good practice)
        while (validHistory.length > 0 && validHistory[0].role !== 'user') validHistory.shift();
        return validHistory;
    }

    /**
     * Apply intelligent filters to tool arguments to prevent data overload
     * @param {string} toolName - Name of the tool being called
     * @param {object} args - Original arguments
     * @param {string} userMessage - User's message for context
     * @param {Array} tools - Available tools with schemas
     * @param {object} [location] - Optional user location data {lat, lon}
     * @returns {object} - Filtered arguments
     */
    applyIntelligentFilters(toolName, args, userMessage, tools, location = null, authContext = null) {
        const filtered = { ...args };

        // 1. Robust Tool Lookup (Direct -> Suffix -> Sanitized)
        let tool = tools.find(t => t.name === toolName);

        if (!tool) {
            // Try matching by suffix (e.g. 'dn_auth...' matching 'api_...__dn_auth...')
            tool = tools.find(t => toolName.endsWith(t.name) || (t.name.includes('__') && t.name.endsWith(toolName)));

            if (tool) {
                console.log(`[Executor] 🔄 Fuzzy matched tool definition: '${tool.name}' for '${toolName}'`);
            }
        }

        if (!tool || !tool.parameters || !tool.parameters.properties) {
            // If still not found, check if it's an auth tool to allow injection regardless?
            // No, we need parameters schema to be safe. But for auth tools we might want to force check.
            if (toolName.includes('auth') || toolName.includes('session')) {
                console.warn(`[Executor] ⚠️ Tool definition not found for '${toolName}', but proceeding for potential Auth Injection.`);
            } else {
                return filtered;
            }
        }

        const params = tool.parameters.properties;

        // 1. AUTO-PAGINATION: Apply default limits to prevent massive data pulls
        if (params.limit && !filtered.limit) {
            filtered.limit = 10;
            console.log(`[Executor] 📊 Auto-applied limit: 10`);
        }

        if (params.page && !filtered.page) {
            filtered.page = 1;
            console.log(`[Executor] 📄 Auto-applied page: 1`);
        }

        // 2. CONTEXT-BASED FILTERS: Extract filters from user message
        const lowerMessage = userMessage.toLowerCase();

        // Extract city names
        let explicitCityDetected = false;
        if (params.city && !filtered.city) {
            const cityPatterns = [
                /em\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i,
                /de\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i,
                /cidade\s+de\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i,
                /moro\s+em\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i,
                /no\s+municipio\s+de\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i
            ];

            for (const pattern of cityPatterns) {
                const match = userMessage.match(pattern);
                if (match && match[1]) {
                    const city = match[1].trim();
                    // Common city names check
                    if (city.length > 3 && city.length < 30) {
                        filtered.city = city;
                        explicitCityDetected = true;
                        console.log(`[Executor] 🏙️ Auto-detected city filter: "${city}"`);

                        // PRIORITY FIX: If user specifies city, remove Geo-Coords to force City-Search
                        if (filtered.lat) delete filtered.lat;
                        if (filtered.lon) delete filtered.lon;
                        if (filtered.latitude) delete filtered.latitude;
                        if (filtered.longitude) delete filtered.longitude;
                        if (filtered.userLat) delete filtered.userLat;
                        if (filtered.userLng) delete filtered.userLng;
                        console.log(`[Executor] 🎯 Enforcing City Search (Cleared Lat/Lon context)`);
                        break;
                    }
                }
            }
        }

        // Extract state (UF)
        if (params.state && !filtered.state) {
            const statePattern = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;
            const match = userMessage.match(statePattern);
            if (match) {
                filtered.state = match[1].toUpperCase();
                console.log(`[Executor] 🗺️ Auto-detected state filter: "${filtered.state}"`);
            }
        }

        // 3. SMART DEFAULTS: Set reasonable defaults for optional filters
        if (params.isRecommended !== undefined && filtered.isRecommended === undefined) {
            filtered.isRecommended = true;
            console.log(`[Executor] ⭐ Auto-applied isRecommended: true`);
        }

        // 4. SPECIFIC FIX: dn_schoolscontroller_getshools - Clear generic 'search_bar'
        // 4. SPECIFIC FIX: dn_schoolscontroller_getshools - Clear generic 'search_bar'
        // PLANNER HINT: When searching for schools to find a course, the planner should:
        // 1. **Find Units**: Call `dn_schoolscontroller_getshools(city="CityName", name="")`.
        //    - **IMPORTANT**: set `name` to EMPTY string (or omit it). Do NOT filter schools by the course name (e.g. "Mechatronics"). We need ANY school nearby.
        if (toolName.includes('schoolscontroller_getshools')) {
            const genericTerms = ['escola', 'escolas', 'school', 'schools', 'unidade', 'senai'];
            // Also clear if it looks like a COURSE topic, because we want 'getshools' to return ALL schools.
            const courseTerms = ['mecatronica', 'mecatrônica', 'robotica', 'robótica', 'elétrica', 'eletrica', 'eletronica', 'eletrônica', 'quimica', 'química', 'segurança', 'logistica', 'gestão', 'ti', 'informatica', 'informática'];

            // Check both 'search_bar' (planner instruction legacy) and 'name' (actual schema)
            const valToCheck = filtered.search_bar || filtered.name || "";
            const term = valToCheck.toLowerCase().trim();

            if (term && (genericTerms.includes(term) || courseTerms.some(t => term.includes(t)))) {
                console.log(`[Executor] 🧹 Clearing schools filter term: "${valToCheck}" (Generic or Course Topic) to allow broad school search.`);
                if (filtered.search_bar) filtered.search_bar = "";
                if (filtered.name) filtered.name = "";
            }
        }

        // 4.1.1. SPECIFIC FIX: dn_companiescontroller_getcompanyprofile
        // - Also benefits from CNPJ injection
        if (toolName.includes('companiescontroller_getcompanyprofile')) {
            // 🔥 INJECT CNPJ from auth if available
            if (this.contextAccumulator && this.contextAccumulator.companyCnpj) {
                if (!filtered.cnpj || filtered.cnpj.trim() === "") {
                    console.log(`[Executor] 💉 Auto-injecting CNPJ for company profile: ${this.contextAccumulator.companyCnpj}`);
                    filtered.cnpj = this.contextAccumulator.companyCnpj;
                }
            }
        }

        // 4.1. SPECIFIC FIX: dn_enterprisecontroller_listenterprise
        // - Requires search_bar (cannot be empty).
        // - Does NOT support lat/lon.
        if (toolName.includes('enterprisecontroller_listenterprise')) {
            // Clean Geo Context
            if (filtered.lat) delete filtered.lat;
            if (filtered.lon) delete filtered.lon;
            if (filtered.latitude) delete filtered.latitude;
            if (filtered.longitude) delete filtered.longitude;

            // 🔥 INJECT CNPJ from auth if available
            if (this.contextAccumulator && this.contextAccumulator.companyCnpj) {
                if (!filtered.search_bar || filtered.search_bar.trim() === "") {
                    console.log(`[Executor] 💉 Auto-injecting CNPJ from auth: ${this.contextAccumulator.companyCnpj}`);
                    filtered.search_bar = this.contextAccumulator.companyCnpj;
                }
            }

            // Handle search_bar
            if (!filtered.search_bar || filtered.search_bar.trim() === "") {
                console.log(`[Executor] 🏢 Enterprise Search: search_bar is empty. Defaulting to "Empresa" (Generic) to list available.`);
                filtered.search_bar = "Empresa";
            }
        }

        // 4.2. AUTO-AUTH INJECTION (Sagaz Security)
        // If the tool is an Auth tool and parameters are missing, try to auto-inject from Resource Profile.
        if (toolName.includes('authcontroller_session') || toolName.includes('login') || toolName.includes('createsession')) {
            console.log(`[Executor] 🔍 DEBUG: Auth tool detected! Tool: ${toolName}`);
            console.log(`[Executor] 🔍 DEBUG: authContext =`, authContext);
            console.log(`[Executor] 🔍 DEBUG: filtered args BEFORE injection =`, filtered);

            let resourceId = null;
            if (!toolName.includes('__') && tools) {
                const match = tools.find(t => t.name.endsWith(toolName) || t.name === toolName);
                if (match && match.name.includes('__')) {
                    const parts = match.name.split('__');
                    const rawId = parts[0].replace('api_', '').replace('db_', '');
                    if (resourceEnricher.resources.has(rawId)) resourceId = rawId;
                    else resourceId = 'default';
                }
            } else if (toolName.includes('__')) {
                const parts = toolName.split('__');
                const rawId = parts[0].replace('api_', '').replace('db_', '');
                resourceId = resourceEnricher.resources.has(rawId) ? rawId : 'default';
            }
            if (!resourceId) resourceId = 'default';

            console.log(`[Executor] 🧠 Using Resource ID: '${resourceId}' for Auth Profile Lookup`);
            const resource = resourceEnricher.resources.get(resourceId);
            let authorizedUser = null;

            if (authContext && authContext.profile) {
                authorizedUser = authContext.profile;
                console.log(`[Executor] 🔐 Using Enforced Auth Context: ${authorizedUser.label}`);
            }

            if (!authorizedUser && resource && resource.authProfiles && resource.authProfiles.length > 0) {
                authorizedUser = resource.authProfiles[0];
                if (toolName.includes('dashboard') || toolName.includes('admin') || toolName.includes('session')) {
                    const adminProfile = resource.authProfiles.find(p => p.role === 'senai_admin');
                    if (adminProfile) authorizedUser = adminProfile;
                }
            }

            if (authorizedUser && authorizedUser.credentials) {
                console.log(`[Executor] 🔐 Auto-Auth: Injecting credentials for user '${authorizedUser.label}' (${authorizedUser.role})`);

                // STRICT PARAMETER MATCHING: Only inject credentials that the tool actually requests.
                // Find tool definition
                const toolDef = tools ? tools.find(t => t.name === toolName) : null;
                const allowedParams = toolDef ? (toolDef.inputSchema?.properties ? Object.keys(toolDef.inputSchema.properties) : []) : [];

                if (toolDef) {
                    console.log(`[Executor] 🛡️ Strict Auth: Tool '${toolName}' accepts: [${allowedParams.join(', ')}]`);
                }

                for (const [paramName, paramValue] of Object.entries(authorizedUser.credentials)) {
                    // 1. STRICT CHECK: Only inject if tool defines this parameter
                    if (allowedParams.length > 0 && !allowedParams.includes(paramName)) {
                        continue; // Skip keys not in schema (e.g. don't send 'cnpj' to a login endpoint that only wants 'email'/'password')
                    }

                    // 2. For AUTH tools: ALWAYS override existing values with profile credentials
                    // This prevents LLM from hallucinating fake emails
                    if (toolName.includes('auth') || toolName.includes('session') || toolName.includes('login')) {
                        filtered[paramName] = paramValue;
                        console.log(`[Executor]    -> ✅ FORCED injection '${paramName}' = ${paramName === 'password' ? '****' : paramValue}`);
                    } else {
                        // For non-auth tools, only inject if missing or invalid
                        const currentVal = filtered[paramName];
                        let shouldOverwrite = false;
                        if (!currentVal) shouldOverwrite = true;
                        else if (paramName === 'email' && !currentVal.includes('@')) shouldOverwrite = true;
                        else if (paramName === 'user' && !currentVal.includes('@')) shouldOverwrite = true;
                        else if (paramName === 'cnpj' && currentVal.length < 5) shouldOverwrite = true;

                        if (shouldOverwrite) {
                            filtered[paramName] = paramValue;
                            console.log(`[Executor]    -> ✅ Injected '${paramName}'`);
                        }
                    }
                }
            }
        }

        // 5. SAGAZ DEFAULTS: Auto-fill Location and CNPJ
        const paramKeys = Object.keys(params);
        if ((paramKeys.includes('lat') || paramKeys.includes('latitude') || paramKeys.includes('userLat') || paramKeys.includes('companyLat')) &&
            (!filtered.lat && !filtered.latitude && !filtered.userLat && !filtered.companyLat)) {

            let lat = -23.5505; // Default SP
            if (location && location.lat) {
                lat = location.lat;
                console.log(`[Executor] 📍 Sagaz Mode: Using BROWSER Location: ${lat}`);
            } else {
                console.log(`[Executor] 📍 Sagaz Mode: Using DEFAULT Location (Sao Paulo): ${lat}`);
            }

            if (paramKeys.includes('lat')) filtered.lat = lat;
            if (paramKeys.includes('latitude')) filtered.latitude = lat;
            if (paramKeys.includes('userLat')) filtered.userLat = lat;
            if (paramKeys.includes('companyLat')) filtered.companyLat = lat;
        }

        if ((paramKeys.includes('lon') || paramKeys.includes('longitude') || paramKeys.includes('userLng') || paramKeys.includes('companyLng')) &&
            (!filtered.lon && !filtered.longitude && !filtered.userLng && !filtered.companyLng)) {

            let lon = -46.6333; // Default SP
            if (location && location.lon) lon = location.lon;

            if (paramKeys.includes('lon')) filtered.lon = lon;
            if (paramKeys.includes('longitude')) filtered.longitude = lon;
            if (paramKeys.includes('userLng')) filtered.userLng = lon;
            if (paramKeys.includes('companyLng')) filtered.companyLng = lon;
        }

        if (paramKeys.includes('schoolsCnpj') && (!filtered.schoolsCnpj || filtered.schoolsCnpj.length === 0)) {
            console.log(`[Executor] 🏢 Sagaz Mode: Injecting Default CNPJ Context`);
            filtered.schoolsCnpj = [{
                cnpj: "60.627.955/0001-31",
                latitude: -23.5505,
                longitude: -46.6333,
                name: "Escola SENAI Default"
            }];
        }

        return filtered;
    }

    /**
     * Compress and truncate tool results to prevent token overflow
     * @param {object} toolResult - Raw tool result
     * @returns {object} - Compressed result
     */
    compressResult(toolResult, limit = 5) {
        // ... (previous code)
        const copy = JSON.parse(JSON.stringify(toolResult));

        if (copy.content && Array.isArray(copy.content)) {
            copy.content.forEach(c => {
                if (c.text) {
                    // Try to parse as JSON for smart truncation
                    try {
                        const data = JSON.parse(c.text);

                        // 1. SMART PRUNING: Remove heavy text fields from lists to save tokens
                        // If it's a list (or has .items), we strip descriptions if there are many items
                        let list = Array.isArray(data) ? data : (data.items || data.data);
                        if (list && Array.isArray(list) && list.length > 3) {
                            list.forEach(item => {
                                if (typeof item === 'object') {
                                    // Delete heavy fields for the "List View" context
                                    delete item.description;
                                    delete item.objective;
                                    delete item.content;
                                    delete item.full_text;
                                    delete item.html_content;
                                    delete item.long_description;
                                }
                            });
                            console.log(`[Executor] 🪶 Pruned heavy text fields from ${list.length} items`);
                        }

                        // 1.5. STRUCTURE OPTIMIZATION: Group by School if applicable
                        if (list && Array.isArray(list)) {
                            const originalLen = list.length;
                            const optimized = this.optimizeStructure(list);
                            if (optimized.length !== originalLen) {
                                // If structure changed, update data
                                if (Array.isArray(data)) data = optimized;
                                else if (data.items) data.items = optimized;
                                else if (data.data) data.data = optimized;

                                console.log(`[Executor] 🏗️ Structure Optimized: Grouped ${originalLen} items into ${optimized.length} groups`);
                            }
                        }

                        // 2. TRUNCATION: Limit to first N items
                        if (Array.isArray(data) && data.length > limit) {
                            const truncated = data.slice(0, limit);
                            c.text = JSON.stringify({
                                items: truncated,
                                _truncated: true,
                                _totalItems: data.length,
                                _message: `Showing ${limit} of ${data.length} items to prevent data overload`
                            });
                            console.log(`[Executor] ✂️ Truncated array from ${data.length} to ${limit} items`);
                            return;
                        }

                        // If it's an object with a data array, limit that
                        if (data.data && Array.isArray(data.data) && data.data.length > limit) {
                            const truncated = { ...data };
                            truncated.data = data.data.slice(0, limit);
                            truncated._truncated = true;
                            truncated._originalCount = data.data.length;
                            c.text = JSON.stringify(truncated);
                            console.log(`[Executor] ✂️ Truncated data array from ${data.data.length} to ${limit} items`);
                            return;
                        }
                    } catch (e) {
                        // Not JSON, fall through to text truncation
                    }

                    // Fallback: Simple text truncation (Scaling with item limit approximation)
                    const charLimit = limit * 600;
                    if (c.text.length > charLimit) {
                        c.text = c.text.substring(0, charLimit) + `\n\n... [DATA TRUNCATED - Showing first ${charLimit} chars]`;
                        console.log(`[Executor] ✂️ Truncated text from ${c.text.length} to ${charLimit} chars`);
                    }
                }
            });
        }

        return copy;
    }

    /**
     * Optimizes structure for UI (Grouping)
     */
    optimizeStructure(data) {
        if (!Array.isArray(data)) return data;

        // HEURISTIC: Check if items have 'schoolName' or 'school' and 'courseName' or 'name'
        // Also check if multiple items share the same school to justify grouping
        const hasSchool = data.some(i => i.schoolName || (i.school && i.school.name));
        const hasCourse = data.some(i => i.courseName || i.name || i.title);

        if (hasSchool && hasCourse) {
            const groups = {};
            data.forEach(item => {
                const schoolName = item.schoolName || (item.school ? item.school.name : 'Unknown School');
                if (!groups[schoolName]) {
                    groups[schoolName] = {
                        school: schoolName,
                        courses: []
                    };
                }

                // Add course to group
                groups[schoolName].courses.push({
                    name: item.courseName || item.name || item.title,
                    modality: item.modality || "Presencial",
                    area: item.area || item.areas,
                    id: item.id || item.courseId
                });
            });

            // Only return grouped if we actually did some grouping (e.g. fewer groups than original items)
            // or if it just looks cleaner.
            const groupList = Object.values(groups);
            if (groupList.length < data.length) {
                return groupList;
            }
        }

        return data; // Return original if no grouping benefit
    }

    /**
     * Extracts potential entities for context persistence
     * (e.g., CNPJs for school courses search)
     */
    extractContextEntities(content) {
        if (!this.contextAccumulator) this.contextAccumulator = {};

        // Loop through content items
        for (const item of content) {
            if (item.type !== 'text' || !item.text) continue;

            try {
                const data = JSON.parse(item.text);
                let arrayData = Array.isArray(data) ? data : (data.items || data.data || []);

                // 1. SCHOOLS / CNPJs Extraction
                if (item.text.includes('cnpj') || item.text.includes('CNPJ')) {
                    if (Array.isArray(arrayData)) {
                        const cnpjs = arrayData
                            .filter(x => (x.cnpj || x.CNPJ) && typeof (x.cnpj || x.CNPJ) === 'string')
                            .map(x => ({
                                cnpj: x.cnpj || x.CNPJ,
                                latitude: x.latitude || x.lat || x.lat_school || 0,
                                longitude: x.longitude || x.lon || x.long_school || 0,
                                name: x.name || x.schoolName || x.nome || "Escola SENAI"
                            })); // Wrap in FULL object as expected by schema

                        if (cnpjs.length > 0) {
                            this.contextAccumulator.schoolsCnpj = cnpjs.slice(0, 5);
                            console.log(`[Executor] 🧠 Extracted ${cnpjs.length} School Objects for Context. Stored first 5.`);
                        }
                    }
                }

                // 2. COURSE IDs Extraction
                // Heuristic: specific course ID patterns or generic "id" in a course search result 
                // We assume if it has 'areas', 'modality', or 'courseId' it's a course.
                if (Array.isArray(arrayData) && arrayData.length > 0) {
                    const firstItem = arrayData[0];
                    if (firstItem.id || firstItem.courseId) {
                        // Check if it looks like a course (has id + name/title)
                        if (firstItem.name || firstItem.title) {
                            const id = firstItem.id || firstItem.courseId;
                            this.contextAccumulator.courseId = id;
                            console.log(`[Executor] 🧠 Extracted Course ID for Context: ${id} (from "${firstItem.name || firstItem.title}")`);
                        }
                        // Ignore parsing errors, it's just a heuristic
                    }
                }
            } catch (e) {
                // Ignore parsing errors, it's just a heuristic
            }
        }
    }

    /**
     * Validates tool parameters before execution
     * Prevents calling APIs with missing required params
     * @private
     */
    _validateToolParams(toolName, params, tools) {
        const tool = tools.find(t => t.name === toolName);
        if (!tool || !tool.parameters) {
            return { valid: true }; // Can't validate, proceed
        }

        const schema = tool.parameters.properties || {};
        const required = tool.parameters.required || [];

        const missing = [];
        for (const req of required) {
            const value = params[req];
            // Check if missing, empty string, or empty array
            if (value === undefined || value === null || value === '' ||
                (Array.isArray(value) && value.length === 0)) {
                missing.push(req);
            }
        }

        if (missing.length > 0) {
            let suggestion = `Missing required parameters: ${missing.join(', ')}`;

            // Context-specific suggestions
            if (toolName.includes('enterprise') || toolName.includes('company')) {
                if (missing.includes('search_bar') || missing.includes('cnpj') || missing.includes('name')) {
                    suggestion = 'Ask user for company CNPJ or company name to search. Without this, the API cannot return results.';
                }
            }

            if (toolName.includes('school')) {
                if (missing.includes('city') && missing.includes('state')) {
                    suggestion = 'Need at least city or state to search schools. Ask user for location.';
                }
            }

            return {
                valid: false,
                missing,
                suggestion,
                reason: `Required params missing: ${missing.join(', ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Detects authentication context from user message
     * Supports MULTI-AUTH: Returns ALL needed profiles (company + admin)
     * @private
     */
    async _detectAuthContext(userMessage, history) {
        const lower = userMessage.toLowerCase();

        // Load auth profiles from ResourceEnricher (Database)
        let profiles = [];
        try {
            profiles = this.resourceEnricher.getAllProfiles();
            console.log(`[Executor] Loaded ${profiles.length} auth profiles from database`);
        } catch (error) {
            console.error(`[Executor] Failed to load auth profiles:`, error);
            return null;
        }

        if (profiles.length === 0) {
            console.warn(`[Executor] No auth profiles found in database`);
            return null;
        }

        // Detect BOTH contexts (pode precisar de múltiplos perfis)
        const isCompanyContext = lower.includes('empresa') || lower.includes('company') ||
            lower.includes('filial') || lower.includes('cnpj');
        const isSenaiContext = lower.includes('senai') || lower.includes('escola') ||
            lower.includes('school') || lower.includes('unidade') || lower.includes('curso');

        const neededProfiles = [];

        // MULTI-AUTH: Se pede empresas E escolas, usa AMBOS perfis
        if (isCompanyContext) {
            const companyProfile = profiles.find(p => p.role === 'company');
            if (companyProfile) {
                neededProfiles.push(companyProfile);
            }
        }

        if (isSenaiContext) {
            const adminProfile = profiles.find(p => p.role === 'senai_admin');
            if (adminProfile) {
                // Evita duplicação se já adicionou
                if (!neededProfiles.find(p => p.role === 'senai_admin')) {
                    neededProfiles.push(adminProfile);
                }
            }
        }

        // Se não detectou nenhum contexto específico, usa admin padrão
        if (neededProfiles.length === 0) {
            const defaultProfile = profiles.find(p => p.role.includes('admin'));
            if (defaultProfile) {
                neededProfiles.push(defaultProfile);
            }
        }

        if (neededProfiles.length === 0) return null;

        // Retorna MÚLTIPLOS perfis se necessário
        const contexts = [];
        if (isCompanyContext) contexts.push('Company/Enterprise');
        if (isSenaiContext) contexts.push('SENAI Administration');
        if (contexts.length === 0) contexts.push('General');

        return {
            context: contexts.join(' + '), // "Company + SENAI"
            profiles: neededProfiles,
            profile: neededProfiles[0] // Mantém compatibilidade com código existente
        };
    }
}

export const executorAgent = new ExecutorAgent();
