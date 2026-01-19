/**
 * Template Cache System
 * Armazena e reutiliza estratégias bem-sucedidas para queries similares
 */

import prisma from '../../registry.js';

export class TemplateCache {
    constructor() {
        this.memoryCache = new Map(); // Cache em memória para acesso rápido
    }

    /**
     * Salva estratégia bem-sucedida como template
     */
    async saveSuccessfulStrategy(strategy, context, result) {
        try {
            console.log('[TemplateCache] 💾 Salvando template...');

            // Gerar padrões de query
            const patterns = this.extractQueryPatterns(context.userMessage);

            // Criar nome do template baseado no contexto
            const name = this.generateTemplateName(context, result);

            const template = await prisma.executionTemplate.create({
                data: {
                    name,
                    queryPatterns: patterns,
                    toolSequence: strategy.steps.map(s => s.toolName || s.tool),
                    processingLogic: strategy.processingType || 'standard',
                    widgetTypes: result.widgets?.map(w => w.type) || [],
                    authRequired: !!strategy.authStrategy,
                    successRate: 1.0,
                    avgExecutionTimeMs: result.executionTime || 0,
                    metadata: {
                        theme: result.theme || context.canvasAnalysis?.theme,
                        dataTypes: this.extractDataTypes(result),
                        confidence: 1.0,
                        createdFrom: context.userMessage
                    }
                }
            });

            console.log(`[TemplateCache] ✅ Template salvo: ${template.id} (${template.name})`);

            // Adicionar ao cache em memória
            this.memoryCache.set(template.id, template);

            return template;
        } catch (error) {
            console.error('[TemplateCache] ❌ Erro ao salvar template:', error.message);
            return null;
        }
    }

    /**
     * Busca template que bate com a query
     */
    async findMatchingTemplate(userMessage, canvasAnalysis = null) {
        try {
            console.log('[TemplateCache] 🔍 Buscando template para:', userMessage.substring(0, 50) + '...');

            // Buscar templates com alta taxa de sucesso
            const templates = await prisma.executionTemplate.findMany({
                where: {
                    successRate: { gte: 0.7 }
                },
                orderBy: [
                    { successRate: 'desc' },
                    { usageCount: 'desc' }
                ],
                take: 20
            });

            if (templates.length === 0) {
                console.log('[TemplateCache] ℹ️ Nenhum template disponível ainda');
                return null;
            }

            // Calcular score de match para cada template
            let bestMatch = null;
            let bestScore = 0;

            for (const template of templates) {
                const score = this.calculateMatchScore(
                    userMessage,
                    template.queryPatterns,
                    canvasAnalysis,
                    template.metadata
                );

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = template;
                }
            }

            // Threshold de 0.8 (80% de similaridade)
            if (bestScore > 0.8) {
                console.log(`[TemplateCache] 🎯 Template encontrado: ${bestMatch.name} (score: ${(bestScore * 100).toFixed(1)}%)`);

                // Atualizar lastUsed e usageCount
                await this.updateTemplateUsage(bestMatch.id);

                return bestMatch;
            }

            console.log(`[TemplateCache] ℹ️ Nenhum template com match suficiente (melhor: ${(bestScore * 100).toFixed(1)}%)`);
            return null;

        } catch (error) {
            console.error('[TemplateCache] ❌ Erro ao buscar template:', error.message);
            return null;
        }
    }

    /**
     * Calcula score de match entre query e template
     */
    calculateMatchScore(userMessage, patterns, canvasAnalysis, templateMetadata) {
        let score = 0;
        const lowerMsg = userMessage.toLowerCase();

        // 1. Pattern matching (60% do score)
        const matchedPatterns = patterns.filter(p => {
            try {
                const regex = new RegExp(p, 'i');
                return regex.test(lowerMsg);
            } catch {
                // Se não for regex válido, fazer match simples
                return lowerMsg.includes(p.toLowerCase());
            }
        });

        if (patterns.length > 0) {
            score += (matchedPatterns.length / patterns.length) * 0.6;
        }

        // 2. Canvas theme similarity (40% do score)
        if (canvasAnalysis?.theme?.primary && templateMetadata?.theme?.primary) {
            const themeSimilarity = this.calculateThemeSimilarity(
                canvasAnalysis.theme.primary,
                templateMetadata.theme.primary
            );
            score += themeSimilarity * 0.4;
        }

        return score;
    }

    /**
     * Calcula similaridade entre temas
     */
    calculateThemeSimilarity(theme1, theme2) {
        if (theme1 === theme2) return 1.0;

        const t1 = theme1.toLowerCase();
        const t2 = theme2.toLowerCase();

        // Levenshtein distance simplificado
        const maxLen = Math.max(t1.length, t2.length);
        let matches = 0;

        for (let i = 0; i < Math.min(t1.length, t2.length); i++) {
            if (t1[i] === t2[i]) matches++;
        }

        return matches / maxLen;
    }

    /**
     * Extrai padrões de query para matching
     */
    extractQueryPatterns(userMessage) {
        const patterns = [];
        const lower = userMessage.toLowerCase();

        // Palavras-chave principais
        const keywords = [
            'empresa', 'filiais', 'curso', 'escola', 'unidade',
            'dashboard', 'relatório', 'listar', 'buscar', 'encontrar'
        ];

        keywords.forEach(kw => {
            if (lower.includes(kw)) {
                patterns.push(kw);
            }
        });

        // Adicionar query completa como padrão (para exact match)
        if (userMessage.length < 100) {
            patterns.push(lower.trim());
        }

        return patterns;
    }

    /**
     * Gera nome do template baseado no contexto
     */
    generateTemplateName(context, result) {
        const theme = result.theme?.primary || context.canvasAnalysis?.theme?.primary || 'unknown';
        const timestamp = Date.now();

        return `${theme.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
    }

    /**
     * Extrai tipos de dados do resultado
     */
    extractDataTypes(result) {
        const types = new Set();

        if (result.widgets) {
            result.widgets.forEach(w => {
                if (w.type) types.add(w.type);
            });
        }

        if (result.gatheredData) {
            types.add('data');
        }

        return Array.from(types);
    }

    /**
     * Atualiza métricas de uso do template
     */
    async updateTemplateUsage(templateId) {
        try {
            await prisma.executionTemplate.update({
                where: { id: templateId },
                data: {
                    lastUsedAt: new Date(),
                    usageCount: { increment: 1 }
                }
            });
        } catch (error) {
            console.error('[TemplateCache] ⚠️ Erro ao atualizar uso:', error.message);
        }
    }

    /**
     * Registra execução no log
     */
    async logExecution(templateId, userMessage, toolsCalled, success, executionTime, dataQuality = null) {
        try {
            await prisma.executionLog.create({
                data: {
                    templateId,
                    userMessage,
                    toolsCalled,
                    success,
                    executionTimeMs: executionTime,
                    dataQuality,
                    metadata: { timestamp: new Date().toISOString() }
                }
            });

            // Atualizar successRate do template
            if (templateId) {
                await this.updateTemplateSuccessRate(templateId);
            }
        } catch (error) {
            console.error('[TemplateCache] ⚠️ Erro ao registrar log:', error.message);
        }
    }

    /**
     * Atualiza taxa de sucesso do template
     */
    async updateTemplateSuccessRate(templateId) {
        try {
            const logs = await prisma.executionLog.findMany({
                where: { templateId },
                select: { success: true }
            });

            if (logs.length === 0) return;

            const successCount = logs.filter(l => l.success).length;
            const successRate = successCount / logs.length;

            await prisma.executionTemplate.update({
                where: { id: templateId },
                data: { successRate }
            });

            console.log(`[TemplateCache] 📊 Updated successRate: ${(successRate * 100).toFixed(1)}% (${successCount}/${logs.length})`);
        } catch (error) {
            console.error('[TemplateCache] ⚠️ Erro ao atualizar successRate:', error.message);
        }
    }

    /**
     * Limpa cache em memória
     */
    clearMemoryCache() {
        this.memoryCache.clear();
        console.log('[TemplateCache] 🧹 Memory cache cleared');
    }
}

// Singleton instance
export const templateCache = new TemplateCache();
