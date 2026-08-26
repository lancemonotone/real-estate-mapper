/** Stable POI-cache keys for free-form nearest Text Search phrases. */

const TEXT_PREFIX = 'text:';

export function normalizeTextQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function textQueryCacheKey(query: string): string {
  const normalized = normalizeTextQuery(query);
  if (!normalized) {
    throw new Error('text query required');
  }
  return `${TEXT_PREFIX}${normalized}`;
}

export function isTextQueryCacheKey(key: string): boolean {
  return key.startsWith(TEXT_PREFIX) && key.length > TEXT_PREFIX.length;
}

export function textQueryFromCacheKey(key: string): string {
  if (!isTextQueryCacheKey(key)) {
    throw new Error(`Not a text query cache key: ${key}`);
  }
  return key.slice(TEXT_PREFIX.length);
}
