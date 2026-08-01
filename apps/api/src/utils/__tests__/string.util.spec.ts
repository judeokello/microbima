/// <reference types="jest" />
import { toTitleCase, trimOrNull } from '../string.util';

describe('string.util', () => {
  describe('toTitleCase', () => {
    it('title-cases single and multi-word names', () => {
      expect(toTitleCase('silver')).toBe('Silver');
      expect(toTitleCase('GOLD')).toBe('Gold');
      expect(toTitleCase('gold plan')).toBe('Gold Plan');
      expect(toTitleCase('  silver  ')).toBe('Silver');
    });
  });

  describe('trimOrNull', () => {
    it('returns null for empty or whitespace', () => {
      expect(trimOrNull('')).toBeNull();
      expect(trimOrNull('   ')).toBeNull();
      expect(trimOrNull(null)).toBeNull();
      expect(trimOrNull('ok')).toBe('ok');
    });
  });
});
