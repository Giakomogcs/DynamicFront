/**
 * Semantic Resource Analyzer - Phase 3 POC
 * Analisa automaticamente tools de um resource para extrair domínio, entidades e workflows
 * Elimina necessidade de hardcode domain-specific
 */

import prisma from '../registry.js';
import { modelManager } from '../services/ai/ModelManager.js';

export class SemanticResourceAnalyzer {
    constructor() {
        this.cache = new Map(); // Cache em memória
    }

    /**
     * Analisa semanticamente um resource e suas tools
     * @param {string} resourceName - Nome do resource
     * @param {Array} tools - Array de tools do resource
     * @returns {Promise<ResourceSemantics>}
     */
    async analyzeResourceSemantics(resourceName, tools) {
        console.log(`\n[SemanticAnalyzer] 🔍 Analisando resource: ${resourceName}`);
        console.log(`[SemanticAnalyzer] Tools disponíveis: ${tools.length}`);

        try {
            // 1. Verificar se já existe análise no banco
            const existing = await prisma.resourceSemantics.findUnique({
                where: { resourceId: resourceName }
            });

            if (existing) {
                console.log(`[SemanticAnalyzer] ♻️ Usando análise existente (cache hit)`);
                this.cache.set(resourceName, existing);
                return existing;
            }

            // 2. Preparar resumo das tools para análise
            const toolSummary = tools.slice(0, 20).map(t => ({
                name: t.name,
                description: t.description || '',
                params: this.extractParamNames(t)
            }));

            console.log(`[SemanticAnalyzer] 🧠 Usando LLM para análise semântica...`);

            // 3. Análise com LLM
            const semantics = await this.analyzeWithLLM(resourceName, toolSummary);

            // 4. Salvar no banco
            const saved = await prisma.resourceSemantics.create({
                data: {
                    resourceId: resourceName,
                    domain: semantics.domain,
                    subDomains: semantics.subDomains,
                    entities: semantics.entities,
                    workflows: semantics.workflows,
                    relationships: semantics.relationships
                }
            });

            console.log(`[SemanticAnalyzer] ✅ Análise salva: domain="${semantics.domain}"`);

            // 5. Cache em memória
            this.cache.set(resourceName, saved);

            return saved;

        } catch (error) {
            console.error(`[SemanticAnalyzer] ❌ Erro ao analisar:`, error.message);

            // Fallback: análise básica sem LLM E SALVAR NO BANCO
            const fallbackSemantics = this.fallbackAnalysis(resourceName, tools);

            try {
                const saved = await prisma.resourceSemantics.create({
                    data: {
                        resourceId: resourceName,
                        domain: fallbackSemantics.domain,
                        subDomains: fallbackSemantics.subDomains,
                        entities: fallbackSemantics.entities,
                        workflows: fallbackSemantics.workflows,
                        relationships: fallbackSemantics.relationships
                    }
                });

                this.cache.set(resourceName, saved);
                console.log(`[SemanticAnalyzer] ✅ Fallback salvo no banco: ${saved.id}`);
                return saved;
            } catch (dbError) {
                console.error('[SemanticAnalyzer] ⚠️ Erro ao salvar fallback:', dbError.message);
                // Retornar sem ID se não conseguiu salvar
                return fallbackSemantics;
            }
        }
    }

    /**
     * Análise com LLM (Gemini)
     */
    async analyzeWithLLM(resourceName, toolSummary) {
        const prompt = `Analyze these API tools and identify the domain, entities, and workflows.

Resource Name: ${resourceName}

Tools (${toolSummary.length}):
${JSON.stringify(toolSummary, null, 2)}

Provide a JSON response with:
{
  "domain": "Primary domain (e.g., Healthcare, Education, E-commerce, Finance, Government, Enterprise)",
  "subDomains": ["Sub-domain 1", "Sub-domain 2"],
  "entities": [
    { "name": "EntityName", "role": "primary|secondary", "description": "brief description" }
  ],
  "workflows": [
    {
      "name": "Workflow name",
      "description": "What this workflow does",
      "steps": ["tool1", "tool2"],
      "trigger_keywords": ["keyword1", "keyword2"]
    }
  ],
  "relationships": [
    { "from": "Entity1", "to": "Entity2", "type": "has_many|belongs_to|references" }
  ]
}

Be concise and focus on the most important patterns.`;

        try {
            const result = await modelManager.generateContent(
                [{ role: 'user', parts: [{ text: prompt }] }],
                {
                    model: 'gemini-2.0-flash-exp',
                    temperature: 0.3,
                    maxTokens: 2000
                }
            );

            const responseText = result.response.text();

            // Extrair JSON do response (pode vir com markdown)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('LLM response não contém JSON válido');
            }

            const semantics = JSON.parse(jsonMatch[0]);

            // Validar estrutura
            if (!semantics.domain || !semantics.entities) {
                throw new Error('LLM response com estrutura inválida');
            }

            return semantics;

        } catch (error) {
            console.warn(`[SemanticAnalyzer] ⚠️ LLM analysis failed:`, error.message);
            throw error;
        }
    }

    /**
     * Análise de fallback (sem LLM) - detecção por padrões
     */
    fallbackAnalysis(resourceName, tools) {
        console.log(`[SemanticAnalyzer] 🔧 Usando fallback analysis (sem LLM)`);

        const domain = this.detectDomainByPatterns(tools);
        const entities = this.detectEntitiesByPatterns(tools);
        const workflows = this.detectWorkflowsByPatterns(tools);

        return {
            resourceId: resourceName,
            domain: domain || 'Unknown',
            subDomains: [],
            entities: entities.map(e => ({ name: e, role: 'detected', description: '' })),
            workflows,
            relationships: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Detecta domínio por padrões nas tools
     */
    detectDomainByPatterns(tools) {
        const toolNames = tools.map(t => t.name.toLowerCase()).join(' ');
        const descriptions = tools.map(t => t.description?.toLowerCase() || '').join(' ');
        const combined = toolNames + ' ' + descriptions;

        // Padrões conhecidos
        const domainPatterns = {
            'Education': ['school', 'course', 'student', 'class', 'lesson', 'curriculum'],
            'Healthcare': ['patient', 'doctor', 'appointment', 'medical', 'health', 'hospital'],
            'E-commerce': ['product', 'order', 'cart', 'payment', 'shipping', 'inventory'],
            'Finance': ['account', 'transaction', 'balance', 'payment', 'invoice', 'billing'],
            'Enterprise': ['company', 'enterprise', 'employee', 'department', 'cnpj'],
            'Government': ['citizen', 'document', 'service', 'request', 'protocol']
        };

        let maxScore = 0;
        let detectedDomain = 'Unknown';

        for (const [domain, keywords] of Object.entries(domainPatterns)) {
            let score = 0;
            for (const keyword of keywords) {
                if (combined.includes(keyword)) score++;
            }

            if (score > maxScore) {
                maxScore = score;
                detectedDomain = domain;
            }
        }

        return maxScore > 0 ? detectedDomain : 'Unknown';
    }

    /**
     * Detecta entidades por padrões
     */
    detectEntitiesByPatterns(tools) {
        const entities = new Set();

        for (const tool of tools) {
            const name = tool.name.toLowerCase();

            // Padrões comuns de entidades
            const patterns = [
                /get(\w+)/, /list(\w+)/, /create(\w+)/, /update(\w+)/, /delete(\w+)/,
                /search(\w+)/, /find(\w+)/
            ];

            for (const pattern of patterns) {
                const match = name.match(pattern);
                if (match && match[1]) {
                    const entity = this.normalizeEntityName(match[1]);
                    if (entity.length > 2) { // Evitar capturas muito curtas
                        entities.add(entity);
                    }
                }
            }
        }

        return Array.from(entities).slice(0, 10); // Limitar a 10 entidades
    }

    /**
     * Detecta workflows por padrões
     */
    detectWorkflowsByPatterns(tools) {
        const workflows = [];

        // Pattern 1: List → Get Details
        const listTools = tools.filter(t =>
            t.name.toLowerCase().includes('list') ||
            t.name.toLowerCase().includes('search')
        );
        const getTools = tools.filter(t =>
            t.name.toLowerCase().includes('get') &&
            !t.name.toLowerCase().includes('list')
        );

        if (listTools.length > 0 && getTools.length > 0) {
            workflows.push({
                name: 'Browse and View Details',
                description: 'List items and view details of selected item',
                steps: [listTools[0].name, getTools[0].name],
                trigger_keywords: ['mostrar', 'listar', 'ver detalhes', 'buscar']
            });
        }

        // Pattern 2: Create workflow
        const createTools = tools.filter(t => t.name.toLowerCase().includes('create'));
        if (createTools.length > 0) {
            workflows.push({
                name: 'Create New Item',
                description: 'Create a new record',
                steps: [createTools[0].name],
                trigger_keywords: ['criar', 'adicionar', 'novo', 'cadastrar']
            });
        }

        return workflows;
    }

    /**
     * Normaliza nome de entidade
     */
    normalizeEntityName(name) {
        // Capitalizar primeira letra
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }

    /**
     * Extrai nomes dos parâmetros de uma tool
     */
    extractParamNames(tool) {
        if (!tool.parameters?.properties) return [];
        return Object.keys(tool.parameters.properties);
    }

    /**
     * Obtém semantics de um resource (com cache)
     */
    async getSemantics(resourceId) {
        // Verificar cache em memória
        if (this.cache.has(resourceId)) {
            return this.cache.get(resourceId);
        }

        // Buscar no banco
        const semantics = await prisma.resourceSemantics.findUnique({
            where: { resourceId }
        });

        if (semantics) {
            this.cache.set(resourceId, semantics);
            return semantics;
        }

        return null;
    }

    /**
     * Atualiza semantics de um resource
     */
    async updateSemantics(resourceId, tools) {
        console.log(`[SemanticAnalyzer] 🔄 Atualizando semantics para: ${resourceId}`);

        // Deletar análise antiga
        await prisma.resourceSemantics.deleteMany({
            where: { resourceId }
        });

        // Cache
        this.cache.delete(resourceId);

        // Reanalisar
        return await this.analyzeResourceSemantics(resourceId, tools);
    }

    /**
     * Lista todos os resources analisados
     */
    async getAllSemantics() {
        return await prisma.resourceSemantics.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Busca resources por domínio
     */
    async findByDomain(domain) {
        return await prisma.resourceSemantics.findMany({
            where: { domain }
        });
    }

    /**
     * Limpa cache em memória
     */
    clearCache() {
        this.cache.clear();
        console.log('[SemanticAnalyzer] 🧹 Cache cleared');
    }
}

// Singleton instance
export const semanticResourceAnalyzer = new SemanticResourceAnalyzer();
