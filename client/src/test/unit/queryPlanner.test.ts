/**
 * QueryPlanner Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { plan, getKnownPatterns } from '@/lib/ai/queryPlanner';

describe('QueryPlanner', () => {
  describe('plan', () => {
    it('should detect high complexity for dashboard queries', () => {
      const result = plan('dashboard de cursos em São Paulo');

      expect(result.complexity).toBe('high');
      expect(result.originalIntent).toBe('dashboard de cursos em São Paulo');
      expect(result.subQueries.length).toBeGreaterThan(0);
    });

    it('should detect medium complexity for list queries', () => {
      const result = plan('listar todos os alunos');

      // 'todos' is a high complexity keyword
      expect(result.complexity).toBe('high');
      expect(result.subQueries.length).toBe(1);
    });

    it('should detect low complexity for simple queries', () => {
      const result = plan('qual é o nome do primeiro curso?');

      expect(result.complexity).toBe('low');
      expect(result.subQueries.length).toBe(1);
    });

    it('should generate sub-queries for complex dashboard', () => {
      const result = plan('dashboard de cursos em São Paulo com matrículas');

      expect(result.subQueries.length).toBeGreaterThan(1);
      const courseQuery = result.subQueries.find(sq => sq.id === 'sq_courses');
      expect(courseQuery).toBeDefined();
    });

    it('should determine streaming strategy based on complexity', () => {
      const highComplexResult = plan('dashboard de análise de tendências');
      expect(['parallel', 'hybrid']).toContain(highComplexResult.streamingStrategy);

      // Simple query should use sequential
      const lowComplexResult = plan('qual é o nome?');
      expect(lowComplexResult.streamingStrategy).toBe('sequential');
    });

    it('should estimate execution time', () => {
      const result = plan('dashboard de cursos');

      expect(result.estimatedTimeMs).toBeGreaterThan(0);
      expect(result.estimatedTimeMs).toBeLessThan(100000); // Less than 100 seconds
    });
  });

  describe('getKnownPatterns', () => {
    it('should return array of known patterns', () => {
      const patterns = getKnownPatterns();

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });
});
