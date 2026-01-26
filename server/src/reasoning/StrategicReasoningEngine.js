/**
 * Strategic Reasoning Engine - Phase 2 POC
 * Motor de raciocínio estratégico com retry inteligente e adaptação
 */

import { templateCache } from '../cache/TemplateCache.js';
import { plannerAgent } from '../agents/Planner.js';
import { executorAgent } from '../agents/Executor.js';

export class StrategicReasoningEngine {
    constructor() {
        this.adaptationStrategies = {
            EMPTY_RESULT: this.broadenSearch.bind(this),
            AUTH_FAILED: this.retryWithAuth.bind(this),
            TOOL_NOT_FOUND: this.findAlternativeTool.bind(this),
            MISSING_PARAMS: this.inferMissingParams.bind(this)
        };
    }

    /**
     * Executa query com estratégia multi-step e retry inteligente
     */
    async execute(context, options = {}) {
        const startTime = Date.now();
        const maxAttempts = options.maxAttempts || 3;
        const adaptOnFailure = options.adaptOnFailure !== false;

        console.log('\n[StrategicEngine] 🧠 Iniciando execução estratégica...');
        console.log(`[StrategicEngine] Query: "${context.userMessage.substring(0, 60)}..."`);

        try {
            // 1. Tentar template cache primeiro
            const cachedTemplate = await templateCache.findMatchingTemplate(
                context.userMessage,
                context.canvasAnalysis
            );

            if (cachedTemplate && cachedTemplate.successRate > 0.8) {
                console.log(`[StrategicEngine] ⚡ Usando template cached`);
                const result = await this.executeFromTemplate(cachedTemplate, context);

                if (result.success) {
                    await templateCache.logExecution(
                        cachedTemplate.id,
                        context.userMessage,
                        result.toolsCalled,
                        true,
                        Date.now() - startTime,
                        result.dataQuality
                    );

                    return {
                        success: true,
                        result,
                        attempts: [result],
                        strategy: { source: 'template', templateId: cachedTemplate.id },
                        executionTime: Date.now() - startTime
                    };
                }
            }

            // 2. Criar estratégia inicial
            let strategy = await this.createInitialStrategy(context);
            const attempts = [];

            // 3. Loop de execução com retry
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                console.log(`\n[StrategicEngine] 🎯 Tentativa ${attempt}/${maxAttempts}`);

                const result = await this.executeStrategy(strategy, context, attempt);
                attempts.push(result);

                // Validar qualidade dos dados
                const isValid = this.validateDataQuality(result);

                if (result.success && isValid) {
                    console.log(`[StrategicEngine] ✅ Sucesso na tentativa ${attempt}`);

                    // Salvar como template para reuso futuro
                    await this.saveAsTemplate(strategy, context, result);

                    // Log execution
                    await templateCache.logExecution(
                        null,
                        context.userMessage,
                        result.toolsCalled || [],
                        true,
                        Date.now() - startTime,
                        result.dataQuality
                    );

                    return {
                        success: true,
                        result,
                        attempts,
                        strategy,
                        executionTime: Date.now() - startTime
                    };
                }

                // Adaptar estratégia para próxima tentativa
                if (adaptOnFailure && attempt < maxAttempts) {
                    console.log(`[StrategicEngine] 🔄 Adaptando estratégia...`);
                    strategy = await this.adaptStrategy(strategy, result, context);
                }
            }

            // Todas as tentativas falharam
            console.log(`[StrategicEngine] ❌ Falhou após ${maxAttempts} tentativas`);

            // Log failure
            await templateCache.logExecution(
                null,
                context.userMessage,
                attempts[attempts.length - 1]?.toolsCalled || [],
                false,
                Date.now() - startTime
            );

            return {
                success: false,
                lastStrategy: strategy,
                attempts,
                fallbackMessage: this.generateFallbackMessage(attempts),
                executionTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('[StrategicEngine] ❌ Erro crítico:', error);
            return {
                success: false,
                error: error.message,
                fallbackMessage: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Cria estratégia inicial
     */
    async createInitialStrategy(context) {
        console.log('[StrategicEngine] 📋 Criando estratégia inicial...');

        // Usar Planner para criar plano
        const plan = await plannerAgent.plan(
            context.userMessage,
            context.tools,
            context.location,
            context.modelName,
            context.history,
            context.canvasAnalysis
        );

        return {
            steps: plan.tools || [],
            thought: plan.thought,
            authStrategy: plan.auth_strategy,
            adaptable: true,
            source: 'planner'
        };
    }

    /**
     * Executa estratégia
     */
    async executeStrategy(strategy, context, attemptNumber) {
        console.log(`[StrategicEngine] ⚙️ Executando ${strategy.steps.length} ferramentas...`);

        try {
            // Usar Executor para executar
            const result = await executorAgent.execute(
                context.userMessage,
                context.history,
                context.modelName,
                context.tools,
                context.location,
                {
                    plan: { tools: strategy.steps, auth_strategy: strategy.authStrategy },
                    attemptNumber
                }
            );

            // Calcular qualidade dos dados
            const dataQuality = this.calculateDataQuality(result);

            return {
                ...result,
                dataQuality,
                toolsCalled: strategy.steps.map(s => s.name || s),
                attemptNumber
            };

        } catch (error) {
            console.error('[StrategicEngine] ❌ Erro na execução:', error.message);
            return {
                success: false,
                error: error.message,
                dataQuality: 0,
                attemptNumber
            };
        }
    }

    /**
     * Executa estratégia a partir de template cached
     */
    async executeFromTemplate(template, context) {
        console.log(`[StrategicEngine] 📦 Executando template: ${template.name}`);

        // Reconstruir estratégia do template
        const strategy = {
            steps: template.toolSequence.map(tool => ({ name: tool })),
            authStrategy: template.authRequired ? { required: true } : null,
            source: 'template',
            templateId: template.id
        };

        return await this.executeStrategy(strategy, context, 1);
    }

    /**
     * Adapta estratégia baseado em falha
     */
    async adaptStrategy(currentStrategy, failedResult, context) {
        const errorType = this.classifyError(failedResult);

        console.log(`[StrategicEngine] 🔍 Erro classificado como: ${errorType}`);

        const adaptationFn = this.adaptationStrategies[errorType];

        if (adaptationFn) {
            return await adaptationFn(currentStrategy, failedResult, context);
        }

        // Sem estratégia de adaptação específica
        console.log('[StrategicEngine] ⚠️ Sem estratégia de adaptação disponível');
        return currentStrategy;
    }

    /**
     * Classifica tipo de erro
     */
    classifyError(result) {
        if (!result.gatheredData || result.gatheredData.length === 0) {
            return 'EMPTY_RESULT';
        }

        if (result.error?.includes('auth') || result.error?.includes('401')) {
            return 'AUTH_FAILED';
        }

        if (result.error?.includes('not found') || result.error?.includes('404')) {
            return 'TOOL_NOT_FOUND';
        }

        if (result.error?.includes('parameter') || result.error?.includes('required')) {
            return 'MISSING_PARAMS';
        }

        return 'UNKNOWN';
    }

    /**
     * Estratégia: Broaden Search
     */
    async broadenSearch(strategy, result, context) {
        console.log('[StrategicEngine] 🔄 Adaptação: Ampliando busca...');

        // Remover filtros restritivos, usar termos mais amplos
        const newSteps = strategy.steps.map(step => {
            if (typeof step === 'object' && step.arguments) {
                const newArgs = { ...step.arguments };

                // Remover filtros específicos
                delete newArgs.status;
                delete newArgs.type;
                delete newArgs.category;

                // Encurtar termo de busca
                if (newArgs.search || newArgs.query) {
                    const searchTerm = newArgs.search || newArgs.query;
                    const words = searchTerm.split(' ');
                    if (words.length > 1) {
                        newArgs.search = words[0]; // Apenas primeira palavra
                    }
                }

                return { ...step, arguments: newArgs };
            }
            return step;
        });

        return {
            ...strategy,
            steps: newSteps,
            adaptations: [...(strategy.adaptations || []), 'broadened_search']
        };
    }

    /**
     * Estratégia: Retry with Auth
     */
    async retryWithAuth(strategy, result, context) {
        console.log('[StrategicEngine] 🔄 Adaptação: Adicionando autenticação...');

        // Adicionar step de auth no início
        const authStep = {
            name: 'dn_authcontroller_session',
            arguments: {}
        };

        return {
            ...strategy,
            steps: [authStep, ...strategy.steps],
            authStrategy: { required: true },
            adaptations: [...(strategy.adaptations || []), 'added_auth']
        };
    }

    /**
     * Estratégia: Find Alternative Tool
     */
    async findAlternativeTool(strategy, result, context) {
        console.log('[StrategicEngine] 🔄 Adaptação: Buscando ferramenta alternativa...');

        // Tentar encontrar tool similar
        const failedTool = strategy.steps.find(s => s.failed);

        if (failedTool) {
            // Buscar alternativa nos tools disponíveis
            const alternatives = context.tools.filter(t =>
                t.description?.toLowerCase().includes(failedTool.name.toLowerCase())
            );

            if (alternatives.length > 0) {
                const newSteps = strategy.steps.map(s =>
                    s === failedTool ? alternatives[0] : s
                );

                return {
                    ...strategy,
                    steps: newSteps,
                    adaptations: [...(strategy.adaptations || []), 'alternative_tool']
                };
            }
        }

        return strategy;
    }

    /**
     * Estratégia: Infer Missing Params
     */
    async inferMissingParams(strategy, result, context) {
        console.log('[StrategicEngine] 🔄 Adaptação: Inferindo parâmetros faltantes...');

        // Tentar inferir parâmetros do contexto
        const newSteps = strategy.steps.map(step => {
            if (typeof step === 'object' && step.arguments) {
                const newArgs = { ...step.arguments };

                // Adicionar localização se faltante
                if (!newArgs.city && context.location) {
                    newArgs.city = context.location;
                }

                return { ...step, arguments: newArgs };
            }
            return step;
        });

        return {
            ...strategy,
            steps: newSteps,
            adaptations: [...(strategy.adaptations || []), 'inferred_params']
        };
    }

    /**
     * Valida qualidade dos dados
     */
    validateDataQuality(result) {
        if (!result.gatheredData) return false;

        const dataQuality = this.calculateDataQuality(result);
        return dataQuality > 0.5; // 50% dos campos preenchidos
    }

    /**
     * Calcula qualidade dos dados (0-1)
     */
    calculateDataQuality(result) {
        if (!result.gatheredData || !Array.isArray(result.gatheredData)) return 0;
        if (result.gatheredData.length === 0) return 0;

        // Analisar completude dos dados
        const sample = result.gatheredData[0];
        if (typeof sample !== 'object') return 0.5;

        const fields = Object.keys(sample);
        const filledFields = fields.filter(f => sample[f] !== null && sample[f] !== undefined && sample[f] !== '');

        return filledFields.length / fields.length;
    }

    /**
     * Salva estratégia como template
     */
    async saveAsTemplate(strategy, context, result) {
        try {
            await templateCache.saveSuccessfulStrategy(strategy, context, result);
            console.log('[StrategicEngine] 💾 Estratégia salva como template');
        } catch (error) {
            console.warn('[StrategicEngine] ⚠️ Erro ao salvar template:', error.message);
        }
    }

    /**
     * Gera mensagem de fallback
     */
    generateFallbackMessage(attempts) {
        const lastAttempt = attempts[attempts.length - 1];

        if (lastAttempt?.error) {
            return `Desculpe, não consegui processar sua solicitação: ${lastAttempt.error}`;
        }

        if (!lastAttempt?.gatheredData || lastAttempt.gatheredData.length === 0) {
            return 'Não encontrei dados para sua solicitação. Tente reformular ou ser mais específico.';
        }

        return 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.';
    }
}

// Singleton instance
export const strategicReasoningEngine = new StrategicReasoningEngine();
