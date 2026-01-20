/**
 * Query Planner
 * Decomposes complex user intents into executable sub-queries
 */

import type { ComplexQuery, SubQuery } from '@/types/ai';

/**
 * Analyze user intent and create execution plan
 */
export function plan(intent: string): ComplexQuery {
  const lowerIntent = intent.toLowerCase();

  // Detect complexity based on keywords
  const complexity = detectComplexity(lowerIntent);

  // Generate sub-queries based on patterns
  const subQueries = generateSubQueries(intent, lowerIntent);

  // Determine streaming strategy
  const streamingStrategy = determineStreamingStrategy(subQueries, complexity);

  return {
    originalIntent: intent,
    complexity,
    subQueries,
    streamingStrategy,
    estimatedTimeMs: estimateExecutionTime(subQueries),
  };
}

/**
 * Detect query complexity
 */
function detectComplexity(lowerIntent: string): 'low' | 'medium' | 'high' {
  // High complexity indicators
  const highComplexityKeywords = [
    'dashboard',
    'analise',
    'análise',
    'comparar',
    'tendência',
    'tendencia',
    'agregado',
    'grupo',
    'todos',
    'todas',
  ];

  // Medium complexity indicators
  const mediumComplexityKeywords = ['listar', 'mostrar', 'buscar', 'filtrar', 'de', 'em'];

  const hasHighComplexity = highComplexityKeywords.some(keyword =>
    lowerIntent.includes(keyword)
  );
  const hasMediumComplexity = mediumComplexityKeywords.some(keyword =>
    lowerIntent.includes(keyword)
  );

  if (hasHighComplexity) return 'high';
  if (hasMediumComplexity) return 'medium';
  return 'low';
}

/**
 * Generate sub-queries based on intent patterns
 */
function generateSubQueries(intent: string, lowerIntent: string): SubQuery[] {
  const subQueries: SubQuery[] = [];

  // Pattern: Dashboard de cursos em São Paulo
  if (
    lowerIntent.includes('dashboard') &&
    (lowerIntent.includes('curso') || lowerIntent.includes('cursos'))
  ) {
    // Sub-query 1: Get courses
    subQueries.push({
      id: 'sq_courses',
      description: 'Buscar todos os cursos',
      dataSource: '/api/courses',
      expectedResults: 1000,
      priority: 'high',
    });

    // Sub-query 2: Get enrollments
    if (lowerIntent.includes('aluno') || lowerIntent.includes('matrícula')) {
      subQueries.push({
        id: 'sq_enrollments',
        description: 'Buscar matrículas dos cursos',
        dataSource: '/api/enrollments',
        expectedResults: 5000,
        priority: 'high',
        dependsOn: ['sq_courses'],
      });
    }

    // Sub-query 3: Filter by location
    if (lowerIntent.includes('são paulo') || lowerIntent.includes('sp')) {
      subQueries.push({
        id: 'sq_filter_location',
        description: 'Filtrar por localização - São Paulo',
        dataSource: 'filter',
        filters: { location: 'São Paulo', state: 'SP' },
        expectedResults: 500,
        priority: 'medium',
        dependsOn: ['sq_courses'],
      });
    }

    // Sub-query 4: Aggregations
    if (lowerIntent.includes('categoria') || lowerIntent.includes('grupo')) {
      subQueries.push({
        id: 'sq_aggregate',
        description: 'Agrupar por categoria',
        dataSource: 'aggregate',
        expectedResults: 50,
        priority: 'medium',
        dependsOn: ['sq_courses'],
      });
    }

    return subQueries;
  }

  // Pattern: Listar/Buscar simples
  if (
    lowerIntent.includes('listar') ||
    lowerIntent.includes('mostrar') ||
    lowerIntent.includes('buscar')
  ) {
    subQueries.push({
      id: 'sq_simple_search',
      description: intent,
      dataSource: '/api/generic-search',
      expectedResults: 100,
      priority: 'high',
    });

    return subQueries;
  }

  // Default: Single generic query
  subQueries.push({
    id: 'sq_default',
    description: intent,
    dataSource: '/api/generic-search',
    expectedResults: 50,
    priority: 'high',
  });

  return subQueries;
}

/**
 * Determine optimal streaming strategy
 */
function determineStreamingStrategy(
  subQueries: SubQuery[],
  complexity: 'low' | 'medium' | 'high'
): 'sequential' | 'parallel' | 'hybrid' {
  // If low complexity, sequential is fine
  if (complexity === 'low') return 'sequential';

  // Check for dependencies
  const hasDependencies = subQueries.some(sq => sq.dependsOn && sq.dependsOn.length > 0);

  // If has dependencies, use hybrid (parallel where possible)
  if (hasDependencies) return 'hybrid';

  // Otherwise, full parallel
  return 'parallel';
}

/**
 * Estimate execution time in milliseconds
 */
function estimateExecutionTime(subQueries: SubQuery[]): number {
  const baseTimePerQuery = 500; // 500ms base
  const timePerRecord = 0.1; // 0.1ms per record

  let totalTime = 0;

  for (const sq of subQueries) {
    totalTime += baseTimePerQuery + sq.expectedResults * timePerRecord;
  }

  // Adjust for parallel execution (assuming 3 concurrent)
  const avgParallelism = Math.min(3, subQueries.length);
  return Math.ceil(totalTime / avgParallelism);
}

/**
 * Get query patterns for debugging/testing
 */
export function getKnownPatterns(): string[] {
  return [
    'dashboard de cursos em São Paulo',
    'listar todos os alunos',
    'buscar cursos de tecnologia',
    'mostrar matrículas ativas',
    'análise de tendências de inscrições',
  ];
}
