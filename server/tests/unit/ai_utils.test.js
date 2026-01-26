import { describe, it, expect } from 'vitest';
import { aiUtils } from '../../src/utils/aiUtils.js';

describe('aiUtils JSON extraction', () => {
    it('should extract JSON from markdown blocks', () => {
        const text = 'Here is the data:\n```json\n{"key": "value"}\n```\nHope this helps!';
        const result = aiUtils.extractJson(text);
        expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from plain text with preamble', () => {
        const text = 'The result is: {"status": "ok", "count": 10}';
        const result = aiUtils.extractJson(text);
        expect(result).toEqual({ status: 'ok', count: 10 });
    });

    it('should extract JSON array from markdown', () => {
        const text = '```json\n[{"id": 1}, {"id": 2}]\n```';
        const result = aiUtils.extractJsonArray(text);
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should extract JSON array from text', () => {
        const text = 'Check these: [{"a": 1}, {"b": 2}]';
        const result = aiUtils.extractJsonArray(text);
        expect(result).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('should return null for invalid JSON', () => {
        const text = 'This is not JSON: {key: value}';
        const result = aiUtils.extractJson(text);
        expect(result).toBeNull();
    });

    it('should return null for empty text', () => {
        expect(aiUtils.extractJson('')).toBeNull();
        expect(aiUtils.extractJson(null)).toBeNull();
    });
});
