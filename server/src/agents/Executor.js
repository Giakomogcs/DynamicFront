/**
 * Executor Agent
 * Executes tool calls with proper authentication
 */
import { modelManager } from '../services/ai/ModelManager.js';
import fs from 'fs';
import { toolService } from '../services/toolService.js';
import { resourceEnricher } from '../core/ResourceEnricher.js';
import { NoProfilesAvailableError } from '../errors/AuthErrors.js';
import { getOriginalToolName } from '../ToolAdapter.js';
import { cacheService } from '../services/CacheService.js';

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
            7. **STRICTLY FORBIDDEN**: Do NOT output code blocks, python scripts, TODO lists, or "placeholder" implementations.
            8. **REQUIRED PARAMS**: If a tool 'search' parameter is required but the user wants "everything", use a broad term (e.g. "%" or the Resource Name). NEVER send an empty string for a required parameter.
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

                // DETECT SILENT FAILURE (Rate Limit / Safety / Empty Stream)
                if (!text && toolCalls.length === 0) {
                    // If we are in the first turn and got NOTHING, it's likely a provider failure.
                    // The retry mechanism in modelManager might have exhausted or just returned empty.
                    if (turn === 1) {
                        throw new Error("Model returned empty response (Silence). identifying as potential Rate Limit or Overload.");
                    }
                }

                // If text is non-empty but just whitespace/newlines
                if (!text.trim() && toolCalls.length === 0) {
                    if (turn === 1) {
                        throw new Error("Model returned only whitespace. identifying as potential Rate Limit or Overload.");
                    }
                }
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
                    // Execute Tools in PARALLEL (Turbo Mode)
                    const toolPromises = toolCalls.map(async (call) => {
                        // FIX: Map sanitized name back to original MCP name
                        const originalName = getOriginalToolName(call.name);
                        if (originalName !== call.name) {
                            call.name = originalName;
                        }

                        console.log(`[Executor] 🚀 Async Launch: ${call.name}`);

                        // Apply filters
                        const filteredArgs = this.applyIntelligentFilters(call.name, call.args, userMessage, tools, location, authContext);

                        // Validation
                        const validation = this._validateToolParams(call.name, filteredArgs, tools);
                        if (!validation.valid) {
                            const errorContent = {
                                isError: true,
                                content: [{ text: JSON.stringify({ error: 'MISSING_PARAMS', details: validation.missing }) }]
                            };
                            return { call, result: errorContent, filteredArgs, isError: true };
                        }

                        // Context Injection (Snapshot for this call)
                        if (this.contextAccumulator) {
                            if (filteredArgs.schoolsCnpj === undefined && this.contextAccumulator.schoolsCnpj && call.name.includes('courses')) {
                                filteredArgs.schoolsCnpj = this.contextAccumulator.schoolsCnpj;
                            }
                        }

                        // Execution
                        try {
                            // Check Cache
                            const cached = cacheService.get(call.name, filteredArgs);
                            let toolResult;

                            if (cached) {
                                console.log(`[Executor] ⚡ Cache Hit: ${call.name}`);
                                toolResult = cached;
                            } else {
                                toolResult = await toolService.executeTool(call.name, filteredArgs);
                                if (!toolResult.isError) {
                                    cacheService.set(call.name, filteredArgs, toolResult, cacheService.getRecommendedTTL(call.name));
                                }
                            }
                            return { call, result: toolResult, filteredArgs, isError: false };
                        } catch (e) {
                            console.error(`[Executor] 💥 Error in ${call.name}:`, e);
                            return { call, result: { isError: true, content: [{ text: `Error: ${e.message}` }] }, filteredArgs, isError: true };
                        }
                    });

                    // Await ALL tools
                    const results = await Promise.all(toolPromises);

                    // Process Results Sequentially for History Consistency
                    for (const { call, result, isError, filteredArgs } of results) {
                        // Auth & Side Effects (Post-Processing)
                        if (!isError && result.content && (call.name.includes('auth') || call.name.includes('session'))) {
                            this._processAuthSideEffects(result, call.args, authContext);
                        }

                        gatheredData.push({ tool: call.name, result: this.compressResult(result, 15) });

                        messages.push({
                            role: 'tool',
                            name: call.name,
                            content: this.compressResult(result, 5)
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
    async applyIntelligentFilters(toolName, args, userMessage, tools, location = null, authContext = null) {
        const filtered = { ...args };

        // 1. Robust Tool Lookup (Direct -> Suffix -> Sanitized)
        let tool = tools.find(t => t.name === toolName);

        if (!tool) {
            // Try matching by suffix (e.g. 'dn_auth...' matching 'api_...__dn_auth...')
            tool = tools.find(t => toolName.endsWith(t.name) || (t.name.includes('__') && t.name.endsWith(toolName)));
        }

        if (!tool || !tool.parameters || !tool.parameters.properties) {
            // Fallback for missing definitions (rare)
            return filtered;
        }

        const params = tool.parameters.properties;
        const paramKeys = Object.keys(params);

        // ---------------------------------------------------------
        // 1. GENERIC PAGINATION DEFAULTS
        // ---------------------------------------------------------
        if (params.limit && !filtered.limit) {
            filtered.limit = 10;
        }
        if (params.page && !filtered.page) {
            filtered.page = 1;
        }

        // ---------------------------------------------------------
        // 2. GENERIC LOCATION INJECTION (System Feature: "Near Me")
        // ---------------------------------------------------------
        // If the tool accepts geo-coordinates and we have the user's location, inject it.
        const latKeys = ['lat', 'latitude', 'userLat', 'userLatitude', 'companyLat'];
        const lonKeys = ['lon', 'longitude', 'lng', 'userLng', 'userLongitude', 'companyLng'];

        const hasLatParam = paramKeys.find(k => latKeys.includes(k));
        const hasLonParam = paramKeys.find(k => lonKeys.includes(k));

        if (hasLatParam && hasLonParam && location) {
            // Only inject if NOT already provided by the model (Planner/Executor might have set specific coords)
            if (!filtered[hasLatParam] && !filtered[hasLonParam]) {
                const latVal = location.lat || location.latitude;
                const lonVal = location.lon || location.longitude || location.lng;

                if (latVal && lonVal) {
                    filtered[hasLatParam] = latVal;
                    filtered[hasLonParam] = lonVal;
                    console.log(`[Executor] 📍 Generic Location Injection: ${latVal}, ${lonVal}`);
                }
            }
        }

        // Auto-set distance if not present (default 50km for geo searches)
        if (params.distance && !filtered.distance) {
            filtered.distance = 50;
        }

        // ---------------------------------------------------------
        // 3. GENERIC CONTEXT INJECTION (Accumulated Memory)
        // ---------------------------------------------------------
        if (this.contextAccumulator) {
            // Iterate over all params the tool accepts
            for (const key of paramKeys) {
                // If the param is missing in the call BUT exists in our memory
                if (!filtered[key] && this.contextAccumulator[key]) {
                    filtered[key] = this.contextAccumulator[key];
                    console.log(`[Executor] 🧠 Context Injection: Injected '${key}' from memory.`);
                }

                // Fuzzy Match for common context keys (e.g. 'companyCnpj' -> 'cnpj')
                if (!filtered[key]) {
                    if (key === 'cnpj' && this.contextAccumulator.companyCnpj) {
                        filtered[key] = this.contextAccumulator.companyCnpj;
                        console.log(`[Executor] 🧠 Context Injection: Injected 'companyCnpj' into 'cnpj'.`);
                    }
                    if (key === 'token' && this.contextAccumulator.authToken) {
                        filtered[key] = this.contextAccumulator.authToken;
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // 4. GENERIC AUTH PROFILE INJECTION (Auto-Auth)
        // ---------------------------------------------------------
        // Determine the RESOURCE ID for this tool to find the correct profile
        let resourceId = 'default';
        if (toolName.includes('__')) {
            const parts = toolName.split('__');
            // Format: api_UUID__action OR db_UUID__action
            const prefix = parts[0];
            // extract UUID
            const uuid = prefix.replace('api_', '').replace('db_', '');
            if (uuid) resourceId = uuid;
        }

        // Find applicable profile
        let authorizedUser = null;
        if (authContext && authContext.profile) {
            authorizedUser = authContext.profile; // Priority: Enforced Context
        } else {
            // Try to find a profile linked to this resource
            const resource = this.resourceEnricher.resources.get(resourceId);
            if (resource && resource.authProfiles && resource.authProfiles.length > 0) {
                authorizedUser = resource.authProfiles[0]; // Use first available profile for this resource
            }
        }

        if (authorizedUser && authorizedUser.credentials) {
            // Iterate over tool params and inject matching credentials
            for (const [paramName, paramValue] of Object.entries(authorizedUser.credentials)) {

                // Only inject if the tool explicitly asks for this parameter
                if (paramKeys.includes(paramName)) {
                    // Force overwrite for sensitive/auth fields (password, token)
                    // Soft overwrite for others (email, user)
                    const isSensitive = ['password', 'token', 'secret', 'key'].some(s => paramName.toLowerCase().includes(s));
                    const isAuthField = ['email', 'user', 'username', 'login'].includes(paramName);

                    if (isSensitive || isAuthField || !filtered[paramName]) {
                        filtered[paramName] = paramValue;
                        const logValue = isSensitive ? '****' : paramValue;
                        console.log(`[Executor] 🔐 Auth Injection: '${paramName}' = ${logValue}`);
                    }
                }
            }
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
    /**
     * Processes side effects from Authentication tool results (Profile updates, token extraction)
     */
    async _processAuthSideEffects(toolResult, args, authContext) {
        try {
            const authText = toolResult.content[0]?.text;
            if (!authText) return;

            const authData = JSON.parse(authText);

            // 1. Update Context Accumulator (Runtime)
            this.contextAccumulator = this.contextAccumulator || {};
            if (authData.cnpj) this.contextAccumulator.companyCnpj = authData.cnpj;
            if (authData.name) this.contextAccumulator.companyName = authData.name;
            if (authData.id) this.contextAccumulator.companyId = authData.id;
            if (authData.token) this.contextAccumulator.authToken = authData.token;

            console.log(`[Executor] 🧠 Extracted from auth: CNPJ=${authData.cnpj || 'N/A'}, Name=${authData.name || 'N/A'}`);

            // 2. DYNAMIC PROFILE UPDATE (Persistence)
            let usedEmail = args.email || args.user;
            if (usedEmail) {
                const profiles = this.resourceEnricher.getAllProfiles();
                const usedProfile = profiles.find(p => p.credentials?.email === usedEmail || p.credentials?.user === usedEmail);

                if (usedProfile) {
                    console.log(`[Executor] 💾 Updating Auth Profile '${usedProfile.label}' with new data...`);
                    const newCredentials = { ...usedProfile.credentials, ...authData };

                    // Simple update check (could be more granular but this is safe)
                    await this.resourceEnricher.updateProfile(usedProfile.resourceId, usedProfile.id, {
                        credentials: newCredentials,
                        label: authData.name || usedProfile.label,
                        role: authData.role || usedProfile.role
                    });
                    console.log(`[Executor] ✅ Auth Profile Updated.`);
                }
            }
        } catch (e) {
            console.warn(`[Executor] Auth side-effect error: ${e.message}`);
        }
    }
}

export const executorAgent = new ExecutorAgent();
