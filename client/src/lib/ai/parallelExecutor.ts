/**
 * Parallel Executor
 * Executes multiple sub-queries concurrently with retry logic and timeout handling
 */

import type { SubQuery, ExecutionResult, ExecutorConfig } from '@/types/ai';

/**
 * Default executor configuration
 */
const DEFAULT_CONFIG: ExecutorConfig = {
  maxConcurrent: 3, // Max 3 parallel executions
  batchSize: 100, // Process 100 items per batch
  retryAttempts: 3, // Retry up to 3 times
  retryDelayMs: 1000, // 1 second between retries
  timeoutMs: 30000, // 30 second timeout per query
};

/**
 * Execute sub-queries with concurrency limit and retry logic
 */
export async function executeWithLimit<T = any>(
  subQueries: SubQuery[],
  executor: (subQuery: SubQuery) => Promise<T>,
  config: Partial<ExecutorConfig> = {}
): Promise<ExecutionResult<T>[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const results: ExecutionResult<T>[] = [];
  const executing: Promise<void>[] = [];

  // Build dependency graph
  const dependencyMap = buildDependencyMap(subQueries);

  // Track completed queries
  const completed = new Set<string>();

  for (const subQuery of subQueries) {
    // Wait for dependencies to complete
    await waitForDependencies(subQuery, completed, dependencyMap);

    // Create execution promise
    const execPromise = executeWithRetry(subQuery, executor, finalConfig)
      .then(result => {
        results.push(result);
        completed.add(subQuery.id);
      })
      .catch(error => {
        console.error(`Failed to execute ${subQuery.id}:`, error);
        results.push({
          queryId: subQuery.id,
          success: false,
          error,
          executionTimeMs: 0,
          retries: finalConfig.retryAttempts,
        });
        completed.add(subQuery.id);
      });

    executing.push(execPromise);

    // Limit concurrency
    if (executing.length >= finalConfig.maxConcurrent) {
      await Promise.race(executing);
      // Remove completed promises
      const stillExecuting = executing.filter(p => {
        // This is a hack to check if promise is still pending
        let isPending = true;
        p.then(() => {
          isPending = false;
        });
        return isPending;
      });
      executing.length = 0;
      executing.push(...stillExecuting);
    }
  }

  // Wait for all remaining executions
  await Promise.all(executing);

  return results;
}

/**
 * Execute a single sub-query with retry logic
 */
async function executeWithRetry<T>(
  subQuery: SubQuery,
  executor: (subQuery: SubQuery) => Promise<T>,
  config: ExecutorConfig
): Promise<ExecutionResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let retries = 0;

  for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
    try {
      // Execute with timeout
      const data = await executeWithTimeout(executor(subQuery), config.timeoutMs);

      const executionTimeMs = Date.now() - startTime;

      return {
        queryId: subQuery.id,
        success: true,
        data,
        executionTimeMs,
        retries,
      };
    } catch (error) {
      lastError = error as Error;
      retries++;

      // Don't retry on last attempt
      if (attempt < config.retryAttempts) {
        console.warn(`Retry ${attempt + 1}/${config.retryAttempts} for ${subQuery.id}`);
        await delay(config.retryDelayMs * (attempt + 1)); // Exponential backoff
      }
    }
  }

  // All retries failed
  const executionTimeMs = Date.now() - startTime;

  return {
    queryId: subQuery.id,
    success: false,
    error: lastError,
    executionTimeMs,
    retries,
  };
}

/**
 * Execute promise with timeout
 */
function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Build dependency map
 */
function buildDependencyMap(subQueries: SubQuery[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const sq of subQueries) {
    if (sq.dependsOn && sq.dependsOn.length > 0) {
      map.set(sq.id, sq.dependsOn);
    }
  }

  return map;
}

/**
 * Wait for dependencies to complete
 */
async function waitForDependencies(
  subQuery: SubQuery,
  completed: Set<string>,
  dependencyMap: Map<string, string[]>
): Promise<void> {
  const dependencies = dependencyMap.get(subQuery.id) || [];

  if (dependencies.length === 0) {
    return; // No dependencies
  }

  // Wait until all dependencies are completed
  const checkInterval = 100; // Check every 100ms
  const maxWaitTime = 60000; // Max 60 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const allCompleted = dependencies.every(dep => completed.has(dep));

    if (allCompleted) {
      return;
    }

    await delay(checkInterval);
  }

  throw new Error(
    `Timeout waiting for dependencies: ${dependencies.filter(d => !completed.has(d)).join(', ')}`
  );
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get executor configuration
 */
export function getConfig(): ExecutorConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Validate sub-queries for circular dependencies
 */
export function validateSubQueries(subQueries: SubQuery[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const visited = new Set<string>();
  const inPath = new Set<string>();

  function hasCycle(id: string, dependencyMap: Map<string, string[]>): boolean {
    if (inPath.has(id)) {
      errors.push(`Circular dependency detected involving: ${id}`);
      return true;
    }

    if (visited.has(id)) {
      return false;
    }

    visited.add(id);
    inPath.add(id);

    const dependencies = dependencyMap.get(id) || [];
    for (const dep of dependencies) {
      if (hasCycle(dep, dependencyMap)) {
        return true;
      }
    }

    inPath.delete(id);
    return false;
  }

  const dependencyMap = buildDependencyMap(subQueries);

  for (const sq of subQueries) {
    hasCycle(sq.id, dependencyMap);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
