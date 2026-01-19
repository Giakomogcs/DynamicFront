import { modelManager } from '../../services/ai/ModelManager.js';
import { executorAgent } from '../../agents/Executor.js';

/**
 * StrategicAgent - Phase 2.1
 * 
 * Intelligent reasoning engine that:
 * - Tries multiple strategies when initial approach fails
 * - Adapts based on failure diagnosis
 * - Learns from successful patterns
 * - Implements "Sagaz" (smart/relentless) mode
 */
export class StrategicAgent {
    constructor() {
        this.maxAttempts = 5;
        this.successPatterns = new Map(); // Cache of successful strategies
    }

    /**
     * Executes a goal with adaptive reasoning
     * @param {Object} goal - User goal with context
     * @param {Array} availableTools - Tools that can be used
     * @param {string} modelName - AI model to use
     * @returns {Promise<Object>} Execution result
     */
    async executeWithReasoning(goal, availableTools, modelName) {
        console.log(`[Strategic] Executing goal with reasoning: "${goal.message.substring(0, 50)}..."`);

        // Check if we have a cached successful pattern for similar goals
        const cachedStrategy = this.findSimilarPattern(goal.message);

        let strategy = cachedStrategy || await this.formulateInitialStrategy(goal, availableTools, modelName);

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            console.log(`[Strategic] Attempt ${attempt}/${this.maxAttempts}`);
            console.log(`[Strategic] Strategy: ${strategy.thought}`);

            const result = await this.executeStrategy(strategy, goal, availableTools, modelName);

            // Check success
            if (this.isSuccessful(result)) {
                console.log(`[Strategic] ✅ Success on attempt ${attempt}!`);

                // Save successful pattern for future
                await this.saveSuccessPattern(goal.message, strategy, result);

                return {
                    success: true,
                    result,
                    attempts: attempt,
                    strategy: strategy.thought,
                    adaptations: strategy.adaptations || []
                };
            }

            // If failed and we have more attempts
            if (attempt < this.maxAttempts) {
                console.log(`[Strategic] ⚠️ Attempt ${attempt} failed. Diagnosing...`);

                const diagnosis = await this.diagnoseFailure(result, strategy);
                console.log(`[Strategic] Diagnosis: ${diagnosis.reason}`);

                // 🔥 STOP RETRYING if we need user input
                if (diagnosis.askUser) {
                    console.log(`[Strategic] 🛑 Stopping retry - need user input`);
                    return {
                        success: false,
                        attempts: attempt,
                        needsUserInput: true,
                        question: diagnosis.suggestion,
                        diagnosis: diagnosis.reason
                    };
                }

                const newStrategy = await this.adaptStrategy(strategy, diagnosis, goal, availableTools, modelName);
                console.log(`[Strategic] 🔄 Adapted strategy: ${newStrategy.thought}`);

                // Track adaptations
                newStrategy.adaptations = strategy.adaptations || [];
                newStrategy.adaptations.push({
                    attempt,
                    diagnosis: diagnosis.reason,
                    adaptation: newStrategy.thought
                });

                strategy = newStrategy;
            }
        }

        // All attempts exhausted
        console.warn(`[Strategic] ❌ Failed after ${this.maxAttempts} attempts`);
        return {
            success: false,
            attempts: this.maxAttempts,
            lastStrategy: strategy.thought,
            adaptations: strategy.adaptations || [],
            fallbackMessage: this.generateFallbackMessage(goal, strategy)
        };
    }

    /**
     * Formulates initial strategy for a goal
     * @private
     */
    async formulateInitialStrategy(goal, availableTools, modelName) {
        const prompt = `You are a strategic planning agent.

User Goal: "${goal.message}"
${goal.location ? `Location: ${goal.location.lat}, ${goal.location.lon}` : ''}
${goal.context ? `Context: ${goal.context}` : ''}

Available Tools (${availableTools.length}):
${availableTools.slice(0, 20).map(t => `- ${t.name}: ${t.description?.substring(0, 100)}`).join('\n')}
${availableTools.length > 20 ? `... and ${availableTools.length - 20} more` : ''}

Create an INITIAL STRATEGY to achieve this goal. Be specific about:
1. Which tools to use and in what order
2. What parameters to use (be specific with values)
3. Backup plans if data is not found
4. How to handle missing location or filters

Return JSON:
{
  "thought": "Strategy explanation",
  "steps": [
    {
      "tool": "tool_name",
      "params": { "key": "value" },
      "purpose": "why this step"
    }
  ],
  "backupPlan": "What to do if this fails"
}`;

        try {
            const result = await modelManager.generateContent(prompt, {
                model: modelName,
                jsonMode: true
            });

            const strategy = JSON.parse(result.response.text());
            return strategy;
        } catch (error) {
            console.warn('[Strategic] Could not generate strategy with LLM, using heuristic');
            return this.heuristicStrategy(goal, availableTools);
        }
    }

    /**
     * Executes a strategy
     * @private
     */
    async executeStrategy(strategy, goal, availableTools, modelName) {
        // Convert strategy steps to executor format
        const toolsToUse = strategy.steps.map(step => {
            const found = availableTools.find(t => t.name === step.tool ||
                (t.name && step.tool && t.name.toLowerCase().includes(step.tool.toLowerCase())));
            return found;
        }).filter(Boolean); // Remove nulls

        if (toolsToUse.length === 0) {
            return {
                success: false,
                error: 'NO_MATCHING_TOOLS',
                message: 'Could not find matching tools for strategy'
            };
        }

        // Execute via Executor
        try {
            const result = await executorAgent.execute(
                goal.message,
                goal.history || [],
                modelName,
                toolsToUse,
                `STRATEGIC PLAN: ${strategy.thought}\nSTEPS: ${JSON.stringify(strategy.steps)}`,
                goal.location,
                goal.resourceSummary
            );

            return result;
        } catch (error) {
            return {
                success: false,
                error: 'EXECUTION_ERROR',
                message: error.message,
                details: error
            };
        }
    }

    /**
     * Determines if execution was successful
     * @private
     */
    isSuccessful(result) {
        // Success criteria:
        // 1. No error
        // 2. Has gathered data OR has meaningful text response
        // 3. Not just empty results

        if (result.error) return false;

        if (result.gatheredData && result.gatheredData.length > 0) return true;

        if (result.text && result.text.length > 50 &&
            !result.text.includes('não encontr') &&
            !result.text.includes('no data') &&
            !result.text.includes('empty')) {
            return true;
        }

        return false;
    }

    /**
     * Diagnoses why a strategy failed
     * @private
     */
    async diagnoseFailure(result, strategy) {
        // Check for structured error from Executor validation
        if (result.text || (result.gatheredData && result.gatheredData.length > 0)) {
            try {
                // Try to parse error from gatheredData or text
                let errorData = null;

                if (result.gatheredData && result.gatheredData.length > 0) {
                    const lastResult = result.gatheredData[result.gatheredData.length - 1];
                    if (lastResult.result && lastResult.result.content) {
                        const content = lastResult.result.content[0]?.text;
                        if (content) {
                            try {
                                errorData = JSON.parse(content);
                            } catch (e) { }
                        }
                    }
                }

                // Check for MISSING_PARAMS error
                if (errorData && errorData.error === 'MISSING_REQUIRED_PARAMS') {
                    return {
                        type: 'MISSING_PARAMS',
                        reason: `Tool '${errorData.tool}' requires: ${errorData.missing.join(', ')}`,
                        suggestion: errorData.suggestion,
                        askUser: true, // Signal that we should ask user, not retry
                        missingParams: errorData.missing
                    };
                }
            } catch (e) {
                // Continue with other checks
            }
        }

        // Classify other failure types
        if (result.error === 'NO_MATCHING_TOOLS') {
            return {
                type: 'TOOL_MISMATCH',
                reason: 'Tool names in strategy do not match available tools',
                suggestion: 'Use exact tool names from available list'
            };
        }

        if (result.error === 'EXECUTION_ERROR') {
            return {
                type: 'EXECUTION_FAILED',
                reason: result.message || 'Tool execution failed',
                suggestion: 'Try alternative tools or adjust parameters'
            };
        }

        // Check if it's empty results (common issue)
        if (!result.gatheredData || result.gatheredData.length === 0) {
            return {
                type: 'NO_DATA',
                reason: 'Query returned no data - filters may be too specific',
                suggestion: 'Broaden search: remove city filter, use state only, or try wildcard search'
            };
        }

        // Check if authentication issue
        if (result.text?.includes('401') || result.text?.includes('403') || result.text?.includes('não autorizado')) {
            return {
                type: 'AUTH_REQUIRED',
                reason: 'Endpoint requires authentication',
                suggestion: 'Select appropriate auth profile from available accounts'
            };
        }

        return {
            type: 'UNKNOWN',
            reason: 'Strategy did not produce meaningful results',
            suggestion: 'Try completely different approach'
        };
    }

    /**
     * Adapts strategy based on diagnosis
     * @private
     */
    async adaptStrategy(oldStrategy, diagnosis, goal, availableTools, modelName) {
        const prompt = `You are adapting failed strategy.

Original Strategy: ${oldStrategy.thought}
Failure Diagnosis: ${diagnosis.reason}
Suggestion: ${diagnosis.suggestion}

User Goal: "${goal.message}"

Available Tools (${availableTools.length}):
${availableTools.slice(0, 20).map(t => `- ${t.name}: ${t.description?.substring(0, 100)}`).join('\n')}

Create NEW ADAPTED STRATEGY that addresses the failure. Common adaptations:
- NO_DATA → Broaden filters (city → state), use wildcards, try different search terms
- TOOL_MISMATCH → Use exact tool names from available list
- AUTH_REQUIRED → Include authentication tool in steps
- EXECUTION_FAILED → Try alternative tools with similar purpose

Return JSON same format:
{
  "thought": "New strategy explanation",
  "steps": [{"tool": "exact_tool_name", "params": {...}, "purpose": "..."}],
  "backupPlan": "..."
}`;

        try {
            const result = await modelManager.generateContent(prompt, {
                model: modelName,
                jsonMode: true
            });

            return JSON.parse(result.response.text());
        } catch (error) {
            // Heuristic adaptation
            return this.heuristicAdaptation(oldStrategy, diagnosis, goal, availableTools);
        }
    }

    /**
     * Heuristic strategy when LLM unavailable
     * @private
     */
    heuristicStrategy(goal, availableTools) {
        const message = goal.message.toLowerCase();

        // Detect what user wants
        const wantsSchools = message.includes('escola') || message.includes('school') || message.includes('senai');
        const wantsCourses = message.includes('curso') || message.includes('course');
        const wantsEnterprises = message.includes('empresa') || message.includes('company');

        if (wantsSchools) {
            const schoolTool = availableTools.find(t => t.name.includes('school') || t.name.includes('getschools'));
            if (schoolTool) {
                return {
                    thought: 'Search for schools using available school tool',
                    steps: [{ tool: schoolTool.name, params: {}, purpose: 'Get schools' }],
                    backupPlan: 'Try broader search if empty'
                };
            }
        }

        if (wantsCourses) {
            const courseTool = availableTools.find(t => t.name.includes('course') || t.name.includes('search'));
            if (courseTool) {
                return {
                    thought: 'Search for courses',
                    steps: [{ tool: courseTool.name, params: {}, purpose: 'Get courses' }],
                    backupPlan: 'Try with different filters'
                };
            }
        }

        // Fallback to first available tool
        return {
            thought: 'Use first available tool as fallback',
            steps: availableTools.slice(0, 1).map(t => ({ tool: t.name, params: {}, purpose: 'Exploratory search' })),
            backupPlan: 'Manual intervention required'
        };
    }

    /**
     * Heuristic adaptation when LLM unavailable
     * @private
     */
    heuristicAdaptation(oldStrategy, diagnosis, goal, availableTools) {
        if (diagnosis.type === 'NO_DATA') {
            // Broadening strategy: remove specific filters
            return {
                thought: 'Broadened search by removing specific filters',
                steps: oldStrategy.steps.map(step => ({
                    ...step,
                    params: { ...step.params, city: undefined, name: '' } // Remove city, empty name = get all
                })),
                backupPlan: 'Try state-level search if still empty'
            };
        }

        if (diagnosis.type === 'TOOL_MISMATCH') {
            // Find similar tools by name
            const newSteps = oldStrategy.steps.map(step => {
                const similarTool = availableTools.find(t =>
                    t.name.toLowerCase().includes(step.tool.toLowerCase().substring(0, 10))
                );
                return similarTool ? { tool: similarTool.name, params: step.params, purpose: step.purpose } : step;
            });

            return {
                thought: 'Corrected tool names to match available tools',
                steps: newSteps,
                backupPlan: oldStrategy.backupPlan
            };
        }

        // Default: retry with same strategy (might be transient error)
        return {
            thought: 'Retrying same strategy (possible transient error)',
            steps: oldStrategy.steps,
            backupPlan: oldStrategy.backupPlan
        };
    }

    /**
     * Finds similar successful pattern from cache
     * @private
     */
    findSimilarPattern(message) {
        const normalized = message.toLowerCase().trim();

        for (const [key, pattern] of this.successPatterns.entries()) {
            if (this.stringSimilarity(normalized, key) > 0.7) {
                console.log(`[Strategic] 🎯 Found similar pattern: "${key}"`);
                return pattern.strategy;
            }
        }

        return null;
    }

    /**
     * Saves successful pattern for future use
     * @private
     */
    async saveSuccessPattern(message, strategy, result) {
        const key = message.toLowerCase().trim();

        this.successPatterns.set(key, {
            strategy,
            result: {
                dataCount: result.gatheredData?.length || 0,
                toolsUsed: strategy.steps.map(s => s.tool)
            },
            timestamp: Date.now()
        });

        console.log(`[Strategic] 💾 Saved success pattern for: "${key}"`);

        // Limit cache size
        if (this.successPatterns.size > 100) {
            const oldest = Array.from(this.successPatterns.keys())[0];
            this.successPatterns.delete(oldest);
        }
    }

    /**
     * String similarity (simple)
     * @private
     */
    stringSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        const common = words1.filter(w => words2.includes(w));
        return common.length / Math.max(words1.length, words2.length);
    }

    /**
     * Generates fallback message when all attempts fail
     * @private
     */
    generateFallbackMessage(goal, lastStrategy) {
        return `Tentei ${this.maxAttempts} estratégias diferentes para: "${goal.message}", mas não consegui obter dados satisfatórios.

Última estratégia tentada: ${lastStrategy.thought}

Sugestões:
- Tente reformular a pergunta com termos mais gerais
- Verifique se os dados existem no sistema
- Pode ser necessário autenticação adicional

Adaptações realizadas: ${lastStrategy.adaptations?.length || 0}`;
    }

    /**
     * Gets stats about cached patterns
     */
    getStats() {
        return {
            cachedPatterns: this.successPatterns.size,
            maxAttempts: this.maxAttempts,
            patterns: Array.from(this.successPatterns.entries()).map(([key, value]) => ({
                query: key,
                toolsUsed: value.result.toolsUsed,
                dataCount: value.result.dataCount
            }))
        };
    }
}

export const strategicAgent = new StrategicAgent();
