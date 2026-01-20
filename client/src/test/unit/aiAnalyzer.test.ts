/**
 * AI Analyzer Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { analyzeUserRequest, isCanvasRelated, extractEntities } from '@/lib/ai/aiAnalyzer';
import type { Session } from '@/types';

describe('AIAnalyzer', () => {
  const mockSession: Session = {
    id: 'session_1',
    name: 'Test Session',
    ownerId: 'user_1',
    status: 'active',
    canvases: [],
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('analyzeUserRequest', () => {
    it('should detect create intent', () => {
      const result = analyzeUserRequest('criar um novo canvas', mockSession);

      expect(result.type).toBe('create');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.suggestedName).toBeDefined();
    });

    it('should detect update intent', () => {
      const mockCanvas = {
        id: 'canvas_1',
        name: 'Test Canvas',
        sessionId: 'session_1',
        htmlContent: '<div>Test</div>',
        cssContent: '',
        jsContent: '',
        version: 1,
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = analyzeUserRequest(
        'adicionar uma tabela ao canvas',
        mockSession,
        mockCanvas
      );

      expect(result.type).toBe('update');
      expect(result.targetCanvas).toBeDefined();
      expect(result.changes).toBeDefined();
    });

    it('should detect delete intent', () => {
      const mockCanvas = {
        id: 'canvas_1',
        name: 'Test Canvas',
        sessionId: 'session_1',
        htmlContent: '',
        cssContent: '',
        jsContent: '',
        version: 1,
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = analyzeUserRequest('remover o canvas', mockSession, mockCanvas);

      expect(result.type).toBe('delete');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return none for informational queries', () => {
      const result = analyzeUserRequest('quantos canvases eu tenho?', mockSession);

      expect(result.type).toBe('none');
      expect(result.reasoning).toContain('informacional');
    });
  });

  describe('isCanvasRelated', () => {
    it('should identify canvas-related messages', () => {
      expect(isCanvasRelated('criar um canvas')).toBe(true);
      expect(isCanvasRelated('adicionar um botão')).toBe(true);
      expect(isCanvasRelated('editar o componente')).toBe(true);
    });

    it('should identify non-canvas messages', () => {
      expect(isCanvasRelated('qual é a temperatura?')).toBe(false);
      expect(isCanvasRelated('olá')).toBe(false);
    });
  });

  describe('extractEntities', () => {
    it('should extract actions, targets, and modifiers', () => {
      const entities = extractEntities('criar uma nova tabela com todos os dados ativos');

      expect(entities.actions).toContain('criar');
      expect(entities.targets).toContain('tabela');
      expect(entities.modifiers).toContain('todos');
      expect(entities.modifiers).toContain('ativo');
    });
  });
});
