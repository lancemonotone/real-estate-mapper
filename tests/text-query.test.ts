import { describe, expect, it } from 'vitest';
import {
  isTextQueryCacheKey,
  normalizeTextQuery,
  textQueryCacheKey,
  textQueryFromCacheKey,
} from '../src/lib/proximity/text-query';

describe('normalizeTextQuery', () => {
  it('trims and collapses whitespace to lowercase', () => {
    expect(normalizeTextQuery('  Gentlemen\'s   Club  ')).toBe("gentlemen's club");
  });
});

describe('textQueryCacheKey', () => {
  it('prefixes a stable normalized key', () => {
    expect(textQueryCacheKey('Gentlemen\'s Club')).toBe("text:gentlemen's club");
  });

  it('rejects empty queries', () => {
    expect(() => textQueryCacheKey('   ')).toThrow(/text query required/i);
  });
});

describe('text query cache key helpers', () => {
  it('round-trips phrase from cache key', () => {
    const key = textQueryCacheKey('pizza');
    expect(isTextQueryCacheKey(key)).toBe(true);
    expect(textQueryFromCacheKey(key)).toBe('pizza');
  });

  it('rejects non-text cache keys', () => {
    expect(isTextQueryCacheKey('beach')).toBe(false);
  });
});
