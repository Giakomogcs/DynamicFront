import { geminiManager } from '../config/gemini.js';
import { toolService } from '../services/toolService.js';
import fs from 'fs';

export class ExecutorAgent {
    constructor() { }

    /**
     * Executes the chat loop with the selected tools.
     * @param {string} userMessage 
     * @param {Array} history 
     * @param {string} modelName 
     * @param {Array} tools - Gemini formatted tools
     * @returns {Promise<{text: string, gatheredData: Array}>}
     */
    async execute(userMessage, history, modelName, tools = []) {
        console.log(`[Executor] Starting execution with ${tools.length} tools.`);

        const executorModel = geminiManager.getPrimaryModel({
            model: modelName,
            tools: tools.length > 0 ? [{ functionDeclarations: tools }] : [],
            systemInstruction: `You are the EXECUTOR Agent. 
            Goal: Answer the user's question using the provided tools.
            
            CRITICAL SQL RULES:
            1. **Filter Early**: ALWAYS use 'WHERE' clauses to filter data in the database. NEVER fetch all rows to filter in code.
            2. **Aggregate**: Use 'COUNT', 'SUM', 'AVG', 'GROUP BY' in SQL. Do not fetch raw rows just to count them.
            3. **Limit Results**: Use 'LIMIT' to prevent fetching thousands of rows.
            4. **Be Specific**: Select specific columns (e.g. 'SELECT name, price') instead of 'SELECT *'.
            5. **Relevance**: Only query what is asked. Do not query "All States" if the user asked for "São Paulo".
            
            General Rules:
            1. Call MULTIPLE tools in PARALLEL whenever possible to save time.
            2. If you need schema for multiple tables, call inspect_schema for all of them at once.
            3. If you have data, return a purely factual summary. 
            4. Do NOT try to build complex UI widgets here. Focus on the DATA.`
        });

        // Prepare History
        const validHistory = this.prepareHistory(history);
        const chat = executorModel.startChat({ history: validHistory });

        let gatheredData = [];
        let finalResponseText = "";

        // Initial Message
        try {
            // We use the queue for the initial message
            let result = await geminiManager.executeQueuedRequest(() => chat.sendMessage(userMessage));
            let response = await result.response;
            let text = response.text();
            let functionCalls = response.functionCalls();

            finalResponseText = text;

            let turn = 0;
            const maxTurns = 5;

            // Dynamic Auth Store for this session
            let sessionAuthHeaders = {};

            while (functionCalls && functionCalls.length > 0 && turn < maxTurns) {
                turn++;
                const parts = [];

                for (const call of functionCalls) {
                    console.log(`[Executor] Tool Call: ${call.name}`);

                    // INJECT AUTH HEADERS if available
                    if (Object.keys(sessionAuthHeaders).length > 0) {
                        call.args._headers = { ...call.args._headers, ...sessionAuthHeaders };
                    }

                    let toolResult;
                    try {
                        toolResult = await toolService.executeTool(call.name, call.args);

                        // CAPTURE AUTH TOKEN from Result
                        if (call.name.includes('login') || call.name.includes('auth')) {
                             const resultText = toolResult.content?.[0]?.text;
                             try {
                                const parsed = JSON.parse(resultText);
                                if (parsed.token || parsed.access_token || parsed.accessToken) {
                                    const token = parsed.token || parsed.access_token || parsed.accessToken;
                                    sessionAuthHeaders['Authorization'] = `Bearer ${token}`;
                                    console.log(`[Executor] Captured Bearer Token from ${call.name}`);
                                }
                             } catch(e) { /* Not JSON */ }
                        }
                    } catch (e) {
                        console.error(`[Executor] Tool Error (${call.name}):`, e);
                        toolResult = { isError: true, content: [{ text: `Error: ${e.message}` }] };
                    }

                    // Track FULL data for Designer
                    gatheredData.push({ tool: call.name, result: toolResult });

                    // COMPRESS data for LLM Context (Save Tokens)
                    const compressedContent = this.compressResult(toolResult);

                    parts.push({
                        functionResponse: {
                            name: call.name,
                            response: { content: compressedContent }
                        }
                    });
                }

                // Send tool outputs back via Queue
                result = await geminiManager.executeQueuedRequest(() => chat.sendMessage(parts));
                response = await result.response;
                text = response.text();
                functionCalls = response.functionCalls();

                finalResponseText = text;
            }

        } catch (error) {
            console.error("[Executor] Error in execution loop:", error);
            fs.writeFileSync('debug_executor.log', `[${new Date().toISOString()}] Error: ${error.message}\n${error.stack}\n`);

            // Expose specific error to user for better debugging (especially 429s)
            if (error.message.includes('429') || error.message.includes('Quota') || error.message.includes('Too Many Requests')) {
                finalResponseText = `⚠️ **System Limit Reached**: The AI model is currently overloaded (Rate Limit/Quota Exceeded). Please try again in a few moments or switch to a different model in the settings.\n\n_Error: ${error.message}_`;
            } else {
                finalResponseText = `I encountered an error processing your request: ${error.message}`;
            }
        }

        return { text: finalResponseText, gatheredData };
    }

    prepareHistory(history) {
        let validHistory = (history || []).map(h => ({
            role: h.role === 'assistant' ? 'model' : h.role,
            parts: [{ text: h.text }]
        })).slice(-10);

        // Ensure first is user
        while (validHistory.length > 0 && validHistory[0].role !== 'user') validHistory.shift();
        return validHistory;
    }

    /**
     * Truncates large responses for the LLM to save context window.
     * The full data is still saved in 'gatheredData' for the Designer.
     */
    compressResult(toolResult) {
        // Deep copy to avoid mutating the original that Designer uses
        const copy = JSON.parse(JSON.stringify(toolResult));

        if (copy.content && Array.isArray(copy.content)) {
            copy.content.forEach(c => {
                if (c.text && c.text.length > 2000) {
                    c.text = c.text.substring(0, 2000) + "\n... [DATA TRUNCATED FOR CONTEXT EFFICIENCY. FULL DATA AVAILABLE TO DESIGNER]";
                }
            });
        }
        return copy;
    }
}

export const executorAgent = new ExecutorAgent();
