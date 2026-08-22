import { describe, expect, it } from 'vitest';
import { PLACE_TYPE_CATALOG } from '../src/lib/proximity/place-types';

describe('PLACE_TYPE_CATALOG', () => {
  it('maps beach to nearby beach type', () => {
    expect(PLACE_TYPE_CATALOG.beach.strategy).toEqual({
      kind: 'nearby',
      includedTypes: ['beach'],
    });
  });
  it('maps park to nearby park type', () => {
    expect(PLACE_TYPE_CATALOG.park.strategy).toEqual({
      kind: 'nearby',
      includedTypes: ['park'],
    });
  });
});
