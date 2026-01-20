/**
 * Data Transformer
 * Transforms large datasets into manageable chunks with enrichment and deduplication
 */

import type { DataChunk, ChunkStrategy } from '@/types/ai';

/**
 * Default chunk size (200 items per chunk)
 */
const DEFAULT_CHUNK_SIZE = 200;

/**
 * Chunk large datasets into smaller pieces for progressive rendering
 */
export function chunkData<T = any>(
  data: T[],
  strategy: ChunkStrategy = { type: 'by-count', itemsPerChunk: DEFAULT_CHUNK_SIZE }
): DataChunk[] {
  if (!data || data.length === 0) {
    return [];
  }

  const chunks: DataChunk[] = [];
  let chunkSize = DEFAULT_CHUNK_SIZE;

  // Determine chunk size based on strategy
  switch (strategy.type) {
    case 'by-count':
      chunkSize = strategy.itemsPerChunk || DEFAULT_CHUNK_SIZE;
      break;
    case 'by-size':
      // Estimate based on size (simplified - assume ~1KB per item)
      const avgItemSize = 1024; // 1KB
      const targetChunkSize = strategy.maxSizeBytes || 200 * 1024; // 200KB default
      chunkSize = Math.floor(targetChunkSize / avgItemSize);
      break;
    case 'by-category':
      // Group by category field (handled separately below)
      return chunkByCategory(data, strategy.categoryField || 'category');
    case 'by-priority':
      // Sort by priority first, then chunk
      const prioritized = [...data].sort((a: any, b: any) => {
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        return priorityB - priorityA; // Higher priority first
      });
      return chunkData(prioritized, { type: 'by-count', itemsPerChunk: chunkSize });
  }

  // Create chunks
  const totalChunks = Math.ceil(data.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const chunkData = data.slice(start, end);

    chunks.push({
      chunkId: `chunk_${i + 1}_of_${totalChunks}`,
      chunkIndex: i,
      totalChunks,
      data: chunkData,
      metadata: {
        title: `Chunk ${i + 1}/${totalChunks}`,
        recordCount: chunkData.length,
        estimatedRenderTimeMs: estimateRenderTime(chunkData.length),
      },
    });
  }

  return chunks;
}

/**
 * Chunk data by category field
 */
function chunkByCategory<T = any>(data: T[], categoryField: string): DataChunk[] {
  const categories = new Map<string, T[]>();

  // Group by category
  for (const item of data) {
    const category = (item as any)[categoryField] || 'uncategorized';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(item);
  }

  // Create chunks per category
  const chunks: DataChunk[] = [];
  let chunkIndex = 0;
  const totalChunks = categories.size;

  for (const [category, items] of categories) {
    chunks.push({
      chunkId: `chunk_${category}`,
      chunkIndex: chunkIndex++,
      totalChunks,
      data: items,
      metadata: {
        title: `Category: ${category}`,
        recordCount: items.length,
        estimatedRenderTimeMs: estimateRenderTime(items.length),
        source: category,
      },
    });
  }

  return chunks;
}

/**
 * Enrich data with additional context
 */
export function enrich<T = any>(
  data: T[],
  context?: Record<string, any>
): T[] {
  const enrichedAt = new Date().toISOString();

  return data.map(item => ({
    ...item,
    _metadata: {
      enrichedAt,
      ...context,
    },
  }));
}

/**
 * Remove duplicate entries based on a key field
 */
export function deduplicate<T = any>(
  data: T[],
  keyField: string = 'id'
): T[] {
  const seen = new Set<any>();
  const unique: T[] = [];

  for (const item of data) {
    const key = (item as any)[keyField];

    if (key === undefined || key === null) {
      // Include items without the key field
      unique.push(item);
      continue;
    }

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

/**
 * Estimate render time based on data size
 */
function estimateRenderTime(itemCount: number): number {
  // Rough estimate: 0.5ms per item for rendering
  const baseTime = 100; // 100ms base overhead
  const perItemTime = 0.5;
  return Math.ceil(baseTime + itemCount * perItemTime);
}

/**
 * Merge multiple chunks back into single dataset
 */
export function mergeChunks(chunks: DataChunk[]): any[] {
  return chunks.flatMap(chunk => chunk.data);
}

/**
 * Get statistics about chunked data
 */
export function getChunkStats(chunks: DataChunk[]): {
  totalChunks: number;
  totalRecords: number;
  avgChunkSize: number;
  estimatedTotalRenderTime: number;
} {
  const totalRecords = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  const estimatedTotalRenderTime = chunks.reduce(
    (sum, chunk) => sum + chunk.metadata.estimatedRenderTimeMs,
    0
  );

  return {
    totalChunks: chunks.length,
    totalRecords,
    avgChunkSize: totalRecords / chunks.length,
    estimatedTotalRenderTime,
  };
}
