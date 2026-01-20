/**
 * Canvas Group Manager - Phase 4 MVP
 * Gerencia decisão de criar novo canvas vs merge com existente
 */

import prisma from '../../registry.js';

export class CanvasGroupManager {
    constructor() {
        this.groupCache = new Map();
    }

    /**
     * Decide se deve criar novo canvas ou fazer merge
     * @param {Object} context - Contexto da requisição
     * @param {Object} newTheme - Tema do novo canvas
     * @param {Array} existingCanvases - Canvas existentes na conversa
     * @returns {Promise<Object>} Decision: { action: 'create'|'merge', targetCanvasId?, groupId? }
     */
    async decideCanvasAction(context, newTheme, existingCanvases = []) {
        console.log('\n[CanvasGroupManager] 🤔 Decidindo ação para canvas...');
        console.log(`[CanvasGroupManager] Tema novo: "${newTheme.primary}"`);
        console.log(`[CanvasGroupManager] Canvas existentes: ${existingCanvases.length}`);

        // Se não há canvas existentes, sempre criar
        if (existingCanvases.length === 0) {
            console.log('[CanvasGroupManager] ✨ Decisão: CREATE (nenhum canvas existente)');
            return {
                action: 'create',
                reason: 'no_existing_canvas'
            };
        }

        // Calcular similaridade com cada canvas existente
        let bestMatch = null;
        let bestScore = 0;

        for (const canvas of existingCanvases) {
            const score = this.calculateThemeSimilarity(newTheme, canvas.theme);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = canvas;
            }
        }

        // Threshold: 70% similaridade = merge, < 70% = create
        const MERGE_THRESHOLD = 0.7;

        if (bestScore >= MERGE_THRESHOLD) {
            console.log(`[CanvasGroupManager] 🔄 Decisão: MERGE com canvas ${bestMatch.id.substring(0, 8)}`);
            console.log(`[CanvasGroupManager] Similaridade: ${(bestScore * 100).toFixed(1)}%`);

            return {
                action: 'merge',
                targetCanvasId: bestMatch.id,
                similarity: bestScore,
                reason: 'theme_similarity_high'
            };
        } else {
            console.log(`[CanvasGroupManager] ✨ Decisão: CREATE (similaridade baixa: ${(bestScore * 100).toFixed(1)}%)`);

            return {
                action: 'create',
                similarity: bestScore,
                reason: 'theme_similarity_low'
            };
        }
    }

    /**
     * Calcula similaridade entre dois temas
     */
    calculateThemeSimilarity(theme1, theme2) {
        // Normalizar temas
        const t1Primary = this.normalizeTheme(theme1.primary || theme1);
        const t2Primary = this.normalizeTheme(theme2.primary || theme2);

        // Exact match
        if (t1Primary === t2Primary) return 1.0;

        // Word overlap
        const words1 = new Set(t1Primary.split(/\s+/));
        const words2 = new Set(t2Primary.split(/\s+/));

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        const jaccardSimilarity = intersection.size / union.size;

        // Substring match bonus
        let substringBonus = 0;
        if (t1Primary.includes(t2Primary) || t2Primary.includes(t1Primary)) {
            substringBonus = 0.2;
        }

        return Math.min(1.0, jaccardSimilarity + substringBonus);
    }

    /**
     * Normaliza tema para comparação
     */
    normalizeTheme(theme) {
        if (typeof theme !== 'string') return '';

        return theme
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ');
    }

    /**
     * Cria ou obtém grupo de canvas para uma conversa
     */
    async getOrCreateGroup(conversationId, themeName = null) {
        // Buscar grupo existente
        let group = await prisma.canvasGroup.findFirst({
            where: { conversationId }
        });

        if (!group) {
            // Criar novo grupo
            group = await prisma.canvasGroup.create({
                data: {
                    conversationId,
                    name: themeName || `Group ${Date.now()}`,
                    description: `Canvas group for conversation ${conversationId}`
                }
            });

            console.log(`[CanvasGroupManager] 📁 Grupo criado: ${group.id}`);
        }

        this.groupCache.set(conversationId, group);
        return group;
    }

    /**
     * Lista canvas de uma conversa
     */
    async getConversationCanvases(conversationId) {
        const canvases = await prisma.canvas.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' }
        });

        return canvases;
    }

    /**
     * Gera estatísticas de decisões
     */
    getDecisionStats() {
        return {
            totalDecisions: this.decisions?.length || 0,
            merges: this.decisions?.filter(d => d.action === 'merge').length || 0,
            creates: this.decisions?.filter(d => d.action === 'create').length || 0
        };
    }
}

// Singleton instance
export const canvasGroupManager = new CanvasGroupManager();
