/**
 * AI Engine Types for DynamicFront v2.0
 * Query planning, execution, and intelligent decision-making
 */

export interface ComplexQuery {
  originalIntent: string;
  complexity: 'low' | 'medium' | 'high';
  subQueries: SubQuery[];
  streamingStrategy: 'sequential' | 'parallel' | 'hybrid';
  estimatedTimeMs?: number;
}

export interface SubQuery {
  id: string;
  description: string;
  dataSource: string;
  filters?: Record<string, any>;
  expectedResults: number;
  priority: 'high' | 'medium' | 'low';
  dependsOn?: string[];
}

export interface ActionDecision {
  type: 'create' | 'update' | 'delete' | 'link' | 'none';
  targetCanvas?: {
    id: string;
    name: string;
  };
  changes?: CanvasChange[];
  suggestedName?: string;
  reasoning: string;
  confidence?: number;
}

export interface CanvasChange {
  section: 'html' | 'css' | 'js';
  operation: 'append' | 'replace' | 'remove' | 'prepend';
  selector?: string;
  content?: string;
  position?: number;
}

export interface ExecutionResult<T = any> {
  queryId: string;
  success: boolean;
  data?: T;
  error?: Error;
  executionTimeMs: number;
  retries: number;
}

export interface DataChunk {
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  data: any[];
  metadata: {
    title: string;
    estimatedRenderTimeMs: number;
    recordCount: number;
    source?: string;
  };
}

export interface StreamEvent {
  type: 'html' | 'chunk' | 'progress' | 'complete' | 'error';
  data?: any;
  progress?: number;
  message?: string;
}

// Executor Configuration
export interface ExecutorConfig {
  maxConcurrent: number;
  batchSize: number;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
}

// Query Strategy
export type QueryStrategy = 'by-count' | 'by-size' | 'by-category' | 'by-priority';

export interface ChunkStrategy {
  type: QueryStrategy;
  itemsPerChunk?: number;
  maxSizeBytes?: number;
  categoryField?: string;
}
