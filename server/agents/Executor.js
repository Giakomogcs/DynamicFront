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

        // Add current user message with STRONG reinforcement if tools are present
        let finalUserMessage = userMessage;
        if (tools && tools.length > 0) {
            finalUserMessage += `\n\n[SYSTEM INSTRUCTION: You have ${tools.length} tools available to answer this. YOU MUST USE THE TOOLS. Do not describe what you would do. CALL THE TOOLS NOW. Return only the tool calls.]`;
        }
        messages.push({ role: 'user', content: finalUserMessage });

        const systemInstruction = `You are the EXECUTOR Agent. 
            Goal: Answer the user's question using the provided tools.
            
            CRITICAL WORKFLOW:
            1. **Analyze Capabilities**: Before running queries, checking the available tools to see if they match the User's intent. "api_name_tool" usually implies data from that API. "db_name_inspect" implies a database.
            2. **Exploration**: If you are unsure where the data is, use 'inspect_schema' or equivalent tools to find the right resource.
            3. **Execution**: Run the query or API call.
            
            CRITICAL SQL RULES:
            1. **Filter Early**: ALWAYS use 'WHERE' clauses to filter data in the database. NEVER fetch all rows to filter in code.
            2. **Aggregate**: Use 'COUNT', 'SUM', 'AVG', 'GROUP BY' in SQL. Do not fetch raw rows to count them.
            3. **Limit Results**: Use 'LIMIT' to prevent fetching thousands of rows.
            4. **Be Specific**: Select specific columns (e.g. 'SELECT name, price') instead of 'SELECT *'.
            5. **Relevance**: Only query what is asked. Do not query "All States" if the user asked for "São Paulo".
            
            General Rules:
            1. Call MULTIPLE tools in PARALLEL whenever possible to save time.
            2. If you need schema for multiple tables, call inspect_schema for all of them at once.
            3. If you have data, return a purely factual summary. 
            4. Do NOT try to build complex UI widgets here. Focus on the DATA.
            5. **IMPORTANT**: If tools are provided, you MUST use them to answer questions about data. Do NOT reply with "I cannot access the database" if you have tools like \`inspect_schema\` or \`run_query\`. USE THEM.
            6. **Context Awareness**: You may be running on a backup model (failover). Even so, you have full access to tools. Be confident.
            7. **API vs Database**: NEVER hallucinate SQL queries (like \`run_query\`) if you are working with an API. If the available tools look like API endpoints (e.g., \`api_name_get_something\`), use THOSE specific tools. Openapi/Swagger IPs are NOT SQL databases. Use the HTTP tools provided.`;

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
                // Note: We need to store toolCalls in the history for next turn context
                // How we store it depends on the Provider's expectation or our generic format
                // Generic: { role: 'model', content: text, toolCalls: [] }
                // But GeminiProvider expects 'parts' mapping.
                // Let's rely on GeminiProvider to map this correctly if we pass it back.

                // If we have tool calls, we MUST push them to history
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
