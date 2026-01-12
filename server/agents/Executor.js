import { modelManager } from '../services/ai/ModelManager.js';
import { toolService } from '../services/toolService.js';
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
    async execute(userMessage, history, modelName, tools = [], planContext = "") {
        console.log(`[Executor] Starting execution with ${tools.length} tools. Model: ${modelName}`);

        // 1. Prepare Initial Messages (Stateless)
        const messages = this.prepareHistory(history);

        let finalUserMessage = userMessage;
        if (planContext) {
            finalUserMessage += `\n\n${planContext}`;
        }
        if (tools && tools.length > 0) {
            finalUserMessage += `\n\n[SYSTEM INSTRUCTION: You have ${tools.length} tools available. You are in FUNCTION CALLING MODE. Follow the [PLANNED STEPS] above strictly. ANALYZE the user's request, DECOMPOSE complex queries, and INVOKE the necessary tools. Use PARALLEL tool calls where appropriate.]`;
        }
        messages.push({ role: 'user', content: finalUserMessage });

        const safeToolNames = tools.map(t => t.name).join(', ');
        const systemInstruction = `You are the EXECUTOR Agent. 
            Goal: Answer the user's question using the provided tools.
            AVAILABLE TOOLS: [${safeToolNames}]
            
            CRITICAL WORKFLOW:
            1. **Analyze Capabilities**: Use ONLY the tools listed above.
            2. **Exploration**: If you are unsure where the data is, use 'inspect_schema' or equivalent tools to find the right resource.
            3. **Execution**: Run the query or API call.
            
            CRITICAL SQL RULES:
            1. **Filter Early**: ALWAYS use 'WHERE' clauses to filter data.
            2. **Robustness**: When filtering text columns (e.g. names, cities), ALWAYS use 'ILIKE' (Postgres) or equivalent for case-insensitive matching.
            3. **Fuzzy Matching**: If unsure of exact spelling, use wildcard '%' (e.g. WHERE city ILIKE '%paulo%').
            
            CRITICAL: DATA FORMATTING & ROBUSTNESS:
            1. **Strict Types**: If a tool asks for an Integer, do NOT send a String.
            2. **Read Descriptions**: Pay extreme attention to tool descriptions.
            3. **Normalize Input**: Try variations (e.g. "Sao Paulo", "SAO PAULO") if needed.
            4. **Retry Logic**: If a tool fails with formatting error, RETRY immediately.

            General Rules:
            1. Call MULTIPLE tools in PARALLEL whenever possible.
            2. If you need schema for multiple tables, call inspect_schema for all of them at once.
            3. If you have data, return a purely factual summary. 
            4. Do NOT try to build complex UI widgets here. Focus on the DATA.
            5. **IMPORTANT**: If tools are provided, you MUST use them.
            6. **API vs Database**: NEVER hallucinate SQL queries.
            7. **Tool Usage**: Generate a native Function Call object.
            
            **CRITICAL INSTRUCTION FOR LLAMA 3 / GROQ:**
            If you cannot generate a native JSON Function Call, you MUST use this specific XML format:
            <function=tool_name>{"argument_name": "value"}</function>
            
            **FORBIDDEN:**
            - DO NOT write Python code.
            - DO NOT write "Here is how you would do it".
            - DO NOT output a tutorial.
            - JUST CALL THE FUNCTION.
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
                        const xmlRegex1 = /<function>([^<]+)<\/function>\s*\(([^)]*)\)/i;
                        const xmlRegex2 = /<function=([^>]+)>([^<]+)<\/function>/i;
                        const match1 = text.match(xmlRegex1);
                        const match2 = text.match(xmlRegex2);

                        if (match1) {
                            const tName = match1[1];
                            if (knownToolNames.includes(tName)) {
                                let args = {};
                                try { args = JSON.parse(match1[2]); } catch (e) { args = { value: match1[2] }; }
                                toolCalls.push({ name: tName, args });
                            }
                        } else if (match2) {
                            const tName = match2[1];
                            if (knownToolNames.includes(tName)) {
                                let argsString = match2[2];
                                let args = {};
                                try { args = JSON.parse(argsString); } catch (e) { args = { value: argsString }; }
                                toolCalls.push({ name: tName, args });
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
                        console.log(`[Executor] >>> Calling Tool: ${call.name}`);
                        let toolResult;
                        try {
                            toolResult = await toolService.executeTool(call.name, call.args);

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
                                            text: `\n[SYSTEM HINT]: The search returned NO results for "${argValues.join(', ')}". \n1. Try REMOVING accents (e.g. "São Paulo" -> "Sao Paulo").\n2. Try UPPERCASE or lowercase.\n3. Try a broader search term.\nRETRY IMMEDIATELY with a modified argument.`
                                        });
                                    }
                                } else {
                                    // 3. Smart Multi-Step Execution (Auto-chaining)
                                    // If we found SENAI units, automatically trigger course search
                                    if (call.name.toLowerCase().includes('getsenaiunits')) {
                                        let data = toolResult.content || toolResult;

                                        // Try to parse if it's a JSON string
                                        if (typeof data === 'string') {
                                            try { data = JSON.parse(data); } catch (e) { }
                                        }

                                        // Extract from wrapper if needed
                                        if (data && data[0] && data[0].text) {
                                            try { data = JSON.parse(data[0].text); } catch (e) { }
                                        }

                                        if (Array.isArray(data) && data.length > 0) {
                                            // Build schoolsCnpj as array of OBJECTS with coordinates
                                            const schoolsCnpj = data
                                                .map(unit => {
                                                    const cnpj = unit.cnpj || unit.CNPJ;
                                                    const lat = unit.latitude || unit.lat;
                                                    const lng = unit.longitude || unit.lng || unit.longtude;
                                                    const name = unit.name || unit.nome || unit.nome_escola;

                                                    if (!cnpj) return null;

                                                    return {
                                                        cnpj: String(cnpj).trim(),
                                                        latitude: lat ? Number(lat) : 0,
                                                        longtude: lng ? Number(lng) : 0, // Note: API uses "longtude" (typo)
                                                        name: name ? String(name) : 'Unidade SENAI'
                                                    };
                                                })
                                                .filter(Boolean)
                                                .slice(0, 10);

                                            if (schoolsCnpj.length > 0) {
                                                console.log(`[Executor] 🔗 Auto-chaining: Found ${schoolsCnpj.length} units. Triggering course search...`);
                                                console.log(`[Executor] 📋 Schools:`, JSON.stringify(schoolsCnpj.slice(0, 2), null, 2));

                                                // Check if course search tool is available
                                                const courseSearchTool = tools.find(t => t.name.toLowerCase().includes('searchorderrecommendedcourses'));
                                                if (courseSearchTool) {
                                                    // Get company location from first unit as fallback
                                                    const firstUnit = schoolsCnpj[0];

                                                    // Force execution of course search
                                                    toolCalls.push({
                                                        name: courseSearchTool.name,
                                                        args: {
                                                            cnpj: firstUnit.cnpj,
                                                            companyLat: firstUnit.latitude,
                                                            companyLng: firstUnit.longtude,
                                                            isRecommended: true,
                                                            schoolsCnpj: schoolsCnpj,
                                                            areas: ['Todas as áreas']
                                                        }
                                                    });
                                                    console.log(`[Executor] ✅ Queued ${courseSearchTool.name} with ${schoolsCnpj.length} schools`);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                        } catch (e) {
                            console.error(`[Executor] Tool Error (${call.name}):`, e);
                            toolResult = { isError: true, content: [{ text: `Error: ${e.message}` }] };
                        }

                        gatheredData.push({ tool: call.name, result: toolResult });
                        const compressedContent = this.compressResult(toolResult);

                        // Append Tool Output to History
                        messages.push({
                            role: 'tool',
                            name: call.name,
                            content: compressedContent
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

    compressResult(toolResult) {
        const copy = JSON.parse(JSON.stringify(toolResult));
        if (copy.content && Array.isArray(copy.content)) {
            copy.content.forEach(c => {
                if (c.text && c.text.length > 2000) {
                    c.text = c.text.substring(0, 2000) + "\n... [DATA TRUNCATED FOR CONTEXT EFFICIENCY]";
                }
            });
        }
        return copy;
    }
}

export const executorAgent = new ExecutorAgent();
