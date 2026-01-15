import { modelManager } from '../services/ai/ModelManager.js';
import { toolService } from '../services/toolService.js';
import { getOriginalToolName } from '../ToolAdapter.js';
import fs from 'fs';

export class ExecutorAgent {
    constructor() { }

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
    async execute(userMessage, history, modelName, tools = [], planContext = "", location = null) {
        console.log(`[Executor] Starting execution with ${tools.length} tools. Model: ${modelName}`);

        // 1. Prepare Initial Messages (Stateless)
        const messages = this.prepareHistory(history);

        let finalUserMessage = userMessage;
        if (planContext) {
            finalUserMessage += `\n\n${planContext}`;
        }
        
        // Inject Location Context
        if (location && location.lat && location.lon) {
            finalUserMessage += `\n\n[CONTEXT: User Location is Latitude ${location.lat}, Longitude ${location.lon}. USE THESE COORDINATES if a tool requires user location.]`;
        }

        messages.push({ role: 'user', content: finalUserMessage });

        const safeToolNames = tools.map(t => t.name).join(', ');
        const systemInstruction = `You are a helpful assistant.
            Your goal is to answer the user's question using the provided tools.
            TOOLS: [${safeToolNames}]
            
            Instructions:
            1. Use the provided tools to answer the request.
            2. Return a Function Call object to invoke a tool.
            3. Answer factually based on tool results.
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
                        const filteredArgs = this.applyIntelligentFilters(call.name, call.args, userMessage, tools);
                        
                        // SMART CONTEXT INJECTION (Accumulator)
                        // If we have previous context for this tool's parameters, inject it if missing
                        if (this.contextAccumulator) {
                             if (filteredArgs.schoolsCnpj === undefined && this.contextAccumulator.schoolsCnpj && toolName.includes('courses')) {
                                   filteredArgs.schoolsCnpj = this.contextAccumulator.schoolsCnpj;
                                   console.log(`[Executor] 🧠 Injecting Context: schoolsCnpj = ${JSON.stringify(filteredArgs.schoolsCnpj)}`);
                             }
                        }

                        let toolResult;
                        try {
                            toolResult = await toolService.executeTool(call.name, filteredArgs);

                            // EXTRACT ENTITIES for future context (Generic Entity Recognition)
                            if (toolResult && !toolResult.isError && toolResult.content) {
                                this.extractContextEntities(toolResult.content);
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


                        const uiResult = this.compressResult(toolResult, 50); // Generous limit for UI
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
     * @returns {object} - Filtered arguments
     */
    applyIntelligentFilters(toolName, args, userMessage, tools) {
        const filtered = { ...args };
        const tool = tools.find(t => t.name === toolName);

        if (!tool || !tool.parameters || !tool.parameters.properties) {
            return filtered;
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
        if (params.city && !filtered.city) {
            const cityPatterns = [
                /em\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i,
                /de\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i,
                /cidade\s+de\s+([\wÀ-ÿ\s]+?)(?:\s|$|\?|,)/i
            ];

            for (const pattern of cityPatterns) {
                const match = userMessage.match(pattern);
                if (match && match[1]) {
                    const city = match[1].trim();
                    // Common city names
                    if (city.length > 3 && city.length < 30) {
                        filtered.city = city;
                        console.log(`[Executor] 🏙️ Auto-detected city filter: "${city}"`);
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
        if (toolName.includes('schoolscontroller_getshools') && filtered.search_bar) {
            const genericTerms = ['escola', 'escolas', 'school', 'schools', 'unidade', 'senai'];
            if (genericTerms.includes(filtered.search_bar.toLowerCase().trim())) {
                console.log(`[Executor] 🧹 Clearing generic search_bar term: "${filtered.search_bar}" to allow broad search.`);
                filtered.search_bar = "";
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

                        // If it's an array, limit to first N items
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
     * Extracts potential entities for context persistence
     * (e.g., CNPJs for school courses search)
     */
    extractContextEntities(content) {
        if (!this.contextAccumulator) this.contextAccumulator = {};

        // Loop through content items
        for (const item of content) {
            if (item.type !== 'text' || !item.text) continue;

            try {
                // Heuristic: Check if result is a List of Schools/Units
                // We look for 'cnpj' fields in JSON arrays
                if (item.text.includes('cnpj') || item.text.includes('CNPJ')) {
                    const data = JSON.parse(item.text);
                    let arrayData = Array.isArray(data) ? data : (data.items || data.data || []);
                    
                    if (Array.isArray(arrayData)) {
                         // Extract CNPJs
                         const cnpjs = arrayData
                            .map(x => x.cnpj || x.CNPJ)
                            .filter(x => x && typeof x === 'string')
                            .map(x => ({ cnpj: x })); // Wrap in object as expected by schema

                         if (cnpjs.length > 0) {
                             // Store only the first 5 to avoid context bloat
                             this.contextAccumulator.schoolsCnpj = cnpjs.slice(0, 5);
                             console.log(`[Executor] 🧠 Extracted ${cnpjs.length} CNPJs for Context. Stored first 5.`);
                         }
                    }
                }
            } catch (e) {
                // Ignore parsing errors, it's just a heuristic
            }
        }
    }
}

export const executorAgent = new ExecutorAgent();
