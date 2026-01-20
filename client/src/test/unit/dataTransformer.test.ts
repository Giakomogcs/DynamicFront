/**
 * DataTransformer Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { chunkData, enrich, deduplicate, getChunkStats } from '@/lib/ai/dataTransformer';

describe('DataTransformer', () => {
  describe('chunkData', () => {
    it('should chunk data by count with default size', () => {
      const data = Array.from({ length: 500 }, (_, i) => ({ id: i, value: `item_${i}` }));
      const chunks = chunkData(data);

      expect(chunks.length).toBe(3); // 500 / 200 = 2.5 -> 3 chunks
      expect(chunks[0].data.length).toBe(200);
      expect(chunks[1].data.length).toBe(200);
      expect(chunks[2].data.length).toBe(100);
    });

    it('should handle empty data', () => {
      const chunks = chunkData([]);
      expect(chunks).toEqual([]);
    });

    it('should chunk data with custom size', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const chunks = chunkData(data, { type: 'by-count', itemsPerChunk: 50 });

      expect(chunks.length).toBe(2);
      expect(chunks[0].data.length).toBe(50);
      expect(chunks[1].data.length).toBe(50);
    });

    it('should include correct metadata', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const chunks = chunkData(data, { type: 'by-count', itemsPerChunk: 50 });

      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].totalChunks).toBe(2);
      expect(chunks[0].metadata.recordCount).toBe(50);
      expect(chunks[0].metadata.estimatedRenderTimeMs).toBeGreaterThan(0);
    });

    it('should chunk by category', () => {
      const data = [
        { id: 1, category: 'A', value: 10 },
        { id: 2, category: 'B', value: 20 },
        { id: 3, category: 'A', value: 30 },
        { id: 4, category: 'C', value: 40 },
        { id: 5, category: 'B', value: 50 },
      ];

      const chunks = chunkData(data, { type: 'by-category', categoryField: 'category' });

      expect(chunks.length).toBe(3); // A, B, C
      expect(chunks.find(c => c.chunkId === 'chunk_A')?.data.length).toBe(2);
      expect(chunks.find(c => c.chunkId === 'chunk_B')?.data.length).toBe(2);
      expect(chunks.find(c => c.chunkId === 'chunk_C')?.data.length).toBe(1);
    });
  });

  describe('enrich', () => {
    it('should add metadata to data', () => {
      const data = [{ id: 1, name: 'Test' }];
      const enriched = enrich(data, { source: 'test' });

      expect(enriched[0]._metadata).toBeDefined();
      expect(enriched[0]._metadata.source).toBe('test');
      expect(enriched[0]._metadata.enrichedAt).toBeDefined();
    });
  });

  describe('deduplicate', () => {
    it('should remove duplicate items', () => {
      const data = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'A Duplicate' },
        { id: 3, name: 'C' },
      ];

      const unique = deduplicate(data, 'id');

      expect(unique.length).toBe(3);
      expect(unique.find(item => item.id === 1)?.name).toBe('A');
    });

    it('should keep items without key field', () => {
      const data = [
        { id: 1, name: 'A' },
        { name: 'No ID' },
        { id: 2, name: 'B' },
      ];

      const unique = deduplicate(data, 'id');

      expect(unique.length).toBe(3);
    });
  });

  describe('getChunkStats', () => {
    it('should calculate correct statistics', () => {
      const data = Array.from({ length: 500 }, (_, i) => ({ id: i }));
      const chunks = chunkData(data);
      const stats = getChunkStats(chunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.totalRecords).toBe(500);
      expect(stats.avgChunkSize).toBeCloseTo(166.67, 1);
      expect(stats.estimatedTotalRenderTime).toBeGreaterThan(0);
    });
  });
});
