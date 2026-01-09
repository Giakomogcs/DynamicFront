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
    async execute(userMessage, history, modelName, tools = []) {
        console.log(`[Executor] Starting execution with ${tools.length} tools. Model: ${modelName}`);

        // 1. Prepare Initial Messages (Stateless)
        // Convert history to generic format {role, content}
        const messages = this.prepareHistory(history);

        let finalUserMessage = userMessage;
        if (tools && tools.length > 0) {
            finalUserMessage += `\n\n[SYSTEM INSTRUCTION: You have ${tools.length} tools available. You are in FUNCTION CALLING MODE. Please ANALYZE the user's request, DECOMPOSE complex queries (especially regions like 'ABC', 'Zona Leste') into specific sub-queries, and INVOKE the necessary tools. Use PARALLEL tool calls where appropriate.]`;
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

            4. **Aggregate**: Use 'COUNT', 'SUM', 'AVG', 'GROUP BY' instead of fetching raw rows.
            5. **Limit**: ALWAYS use 'LIMIT 10' (or similar) unless specifically asked for all.
            
            CRITICAL: DATA FORMATTING & ROBUSTNESS:
            1. **Strict Types**: If a tool asks for an Integer, do NOT send a String. If it asks for "YYYY-MM-DD", do NOT send "01/01/2025".
            2. **Read Descriptions**: Pay extreme attention to tool descriptions. They often contain hidden constraints (e.g. "Input must be 6 digits", "Use uppercase codes").
            3. **Normalize Input**: If the user says "são paulo" but the API/DB is likely to use normalized data or if previous attempts failed, try variations (e.g. "Sao Paulo", "SAO PAULO").
            4. **Retry Logic**: If a tool fails with a formatting error (e.g. "Invalid date"), RETRY immediately with the corrected format. Do NOT give up.

            General Rules:
            1. Call MULTIPLE tools in PARALLEL whenever possible.
            2. If you need schema for multiple tables, call inspect_schema for all of them at once.
            3. If you have data, return a purely factual summary. 
            4. Do NOT try to build complex UI widgets here. Focus on the DATA.
            5. **IMPORTANT**: If tools are provided, you MUST use them.
            6. **API vs Database**: NEVER hallucinate SQL queries (like \`run_query\`) if you are working with an API. If the available tools look like API endpoints (e.g., \`api_name_get_something\`), use THOSE specific tools.
            7. **Tool Usage**: Do NOT simulate the tool call in text. Generate a native Function Call object.

            ADVANCED QUERY ANALYSIS:
            *   **CRITICAL**: Check the 'inputSchema' of the tool before calling it. Do NOT invent parameters (e.g. do not pass 'city' to a tool that requires 'latitude'/'longitude').
            *   **Search Strategy for Linked Resources**:
                *   If you need to find "Items" (Courses, Products, Doctor Availability) in a "Location":
                    1.  First, search for the **Provider/Entity** (School, Store, Clinic) in that location using available tools.
                    2.  Then, use the IDs/Keys from those results to query the "Items" endpoint.
                    3.  **Do not** call an "Item" search tool directly with a City name unless the tool explicitly accepts 'city'.
            *   **Geographic Decomposition**: If the user asks for a region (e.g. "ABC Paulista", "Zona Leste", "Vale do Paraíba"), YOU MUST DECOMPOSE it into specific cities and search for EACH city individually.
                *   Example: "ABC Paulista" -> Search "Santo André", "São Bernardo do Campo", "São Caetano do Sul", "Diadema", "Mauá", "Ribeirão Pires", "Rio Grande da Serra".
                *   Search for schools/entities in EACH city.
            *   **Course/Topic Search**: If the user asks for specific courses (e.g. "Excel", "Mecânica") AND a location:
                1. Search for schools in the location first.
                2. If available, use a course search tool *scoped to those schools* or check the school details.
                3. If no direct text search for courses exists by city, explain this limitation and list the schools where the user can find these courses.
            *   **Contextual Analysis**:
                *   Do not just list raw JSON. Summarize the findings.
                *   If searching for "ABC Paulista", aggregate the results: "Found X schools in Santo André, Y in São Bernardo...".
                *   Highlight if a city returned no results.`;

        let gatheredData = [];
        let finalResponseText = "";
        let turn = 0;
        const maxTurns = 5;

        try {
            while (turn < maxTurns) {
                turn++;

                // CALL AI
                const result = await modelManager.generateContentWithFailover(messages, {
                    model: modelName,
                    tools: tools, // Provider knows how to map these
                    systemInstruction
                });

                // Parse Result (Universal Response Wrapper)
                const response = result.response;
                const text = response.text() || ""; // Sometimes empty if just tool calls
                const toolCalls = response.functionCalls ? response.functionCalls() : [];

                finalResponseText = text;

                // Append Assistant Response to History
                if (toolCalls.length > 0) {
                     // Native call found
                }

                // FALLBACK: If no native tool calls, check if model wrote them in text (Common with Llama/Backup models)
                if (toolCalls.length === 0 && text) {
                    const knownToolNames = tools.map(t => t.name);

                    // Strategy A: Try parsing the whole text as a JSON Tool Call
                    try {
                        const json = JSON.parse(text);
                        // Check if it matches { name: "...", parameters/args: ... }
                        if (json.name && knownToolNames.includes(json.name)) {
                             console.log(`[Executor] 🛠️ Detected JSON-based tool call for '${json.name}'.`);
                             toolCalls.push({
                                 name: json.name,
                                 args: json.parameters || json.args || {}
                             });
                        } else if (json.type === 'function' && json.name) { // OpenAI style sometimes leaked
                             toolCalls.push({
                                 name: json.name,
                                 args: json.parameters || json.arguments || {}
                             });
                        } else if (Array.isArray(json) && json.length >= 1 && knownToolNames.includes(json[0])) {
                             // Handle [ "tool_name", "arg_string_or_obj" ]
                             console.log(`[Executor] 🛠️ Detected Array-based tool call for '${json[0]}'.`);
                             let args = json[1] || {};
                             // specific fix for ["run_query", "SELECT..."] where args is just the SQL string
                             if (typeof args === 'string') {
                                 if (json[0].includes('query')) args = { sql: args };
                                 else if (json[0].includes('inspect')) args = { search: args };
                             }
                             toolCalls.push({
                                 name: json[0],
                                 args: args
                             });
                        }
                    } catch (e) {
                         // Not a pure JSON response
                    }

                    // Strategy B: XML-style <function>name</function>(args)
                    if (toolCalls.length === 0) {
                        const xmlRegex = /<function>([^<]+)<\/function>\s*\(([^)]*)\)/i;
                        const match = text.match(xmlRegex);
                        if (match) {
                             const tName = match[1];
                             if (knownToolNames.includes(tName)) {
                                 console.log(`[Executor] 🛠️ Detected XML-based tool call for '${tName}'.`);
                                 let argsString = match[2];
                                 let args = {};
                                 try { args = JSON.parse(argsString); } catch(e) { 
                                     // fallback for strings
                                     if (tName.includes('query')) args = { sql: argsString.replace(/^["']|["']$/g, '') };
                                     else args = { search: argsString.replace(/^["']|["']$/g, '') };
                                 } 
                                 toolCalls.push({ name: tName, args: args || {} });
                             }
                        }
                    }

                    // Strategy C: Regex Match tool_name(args)
                    // We look for known tool names followed by parenthesis
                    if (toolCalls.length === 0) {
                        for (const toolName of knownToolNames) {
                            if (text.includes(toolName)) {
                                // Simple regex to capture arguments: toolName( ... )
                                const regex = new RegExp(`${toolName}\\s*\\(([^)]*)\\)`, 'i');
                                const match = text.match(regex);
                                if (match) {
                                    console.log(`[Executor] 🛠️ Detected text-based tool call for '${toolName}'. Parsing...`);
                                    let argsString = match[1].trim();
                                    let args = {};
                                    try {
                                        // Try strict JSON first
                                        args = JSON.parse(argsString);
                                    } catch (e) {
                                        try {
                                            // Heuristic A: Key-Value pairs (param="value")
                                            // Matches: key="value" or key='value' or key=value (simple)
                                            const kvRegex = /(\w+)=["']?([^"'\s]+)["']?/g; // Simple non-spaced values
                                            // Better Regex for quoted string support: (\w+)=(["'])(.*?)\2
                                            const kvRegexComplex = /(\w+)=(["'])(.*?)\2/g;
                                            
                                            let kvMatch;
                                            let hasKv = false;
                                            
                                            // Try capturing all key="val" matches
                                            while ((kvMatch = kvRegexComplex.exec(argsString)) !== null) {
                                                args[kvMatch[1]] = kvMatch[3];
                                                hasKv = true;
                                            }
                                            
                                            if (!hasKv) {
                                                // Heuristic B: SQL/Search single string fallback
                                                if (toolName.includes('query') && !argsString.trim().startsWith('{')) {
                                                     const sql = argsString.replace(/^["']|["']$/g, '');
                                                     args = { sql };
                                                } else if (toolName.includes('inspect') && !argsString.trim().startsWith('{')) {
                                                     const table = argsString.replace(/^["']|["']$/g, '');
                                                     args = { search: table };
                                                     if (tools.find(t=>t.name === toolName).parameters?.properties?.table_name) {
                                                        args = { table_name: table };
                                                     }
                                                } else {
                                                    // Warning but don't crash loop
                                                    console.warn(`[Executor] Could not parse args for ${toolName}: ${argsString}`);
                                                    continue; 
                                                }
                                            }
                                        } catch (e2) {
                                            console.warn(`[Executor] Parsing failed for ${toolName}`);
                                            continue;
                                        }
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
                                // If args contained a string value, try to suggest normalization
                                if (resultStr.length < 50 || resultStr.includes('"length":0') || resultStr.includes('[]')) {
                                    const argValues = Object.values(call.args).filter(v => typeof v === 'string');
                                    if (argValues.length > 0) {
                                        console.log(`[Executor] 🔄 Empty result detected. Suggesting normalization retry for: ${argValues.join(', ')}`);
                                        // We append a "system hint" to the result for the NEXT turn
                                        toolResult.content.push({
                                            type: "text",
                                            text: `\n[SYSTEM HINT]: The search returned NO results for "${argValues.join(', ')}". \n1. Try REMOVING accents (e.g. "São Paulo" -> "Sao Paulo").\n2. Try UPPERCASE or lowercase.\n3. Try a broader search term.\nRETRY IMMEDIATELY with a modified argument.`
                                        });
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
                    // No tools, just text response. We are done.
                    break;
                }
            }
        } catch (error) {
            console.error("[Executor] Error in execution loop:", error);
            fs.writeFileSync('debug_executor.log', `[${new Date().toISOString()}] Error: ${error.message}\n${error.stack}\n`);

            if (error.message.includes('429') || error.message.includes('Quota') || error.message.includes('Too Many Requests')) {
                finalResponseText = `⚠️ **System Limit Reached**: The AI model is currently overloaded. Please try again later or switch models.`;
            } else {
                finalResponseText = `I encountered an error processing your request: ${error.message}`;
            }
        }

        return { text: finalResponseText, gatheredData };
    }

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
