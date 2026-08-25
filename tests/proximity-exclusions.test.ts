import { describe, expect, it } from 'vitest';
import { withoutExcludedPois, pairsToRecomputeAfterExclude } from '../src/lib/proximity/exclusions';

describe('withoutExcludedPois', () => {
  const pois = [
    { placeId: 'a', name: 'A', lat: 1, lng: 1 },
    { placeId: 'b', name: 'B', lat: 2, lng: 2 },
    { placeId: 'c', name: 'C', lat: 3, lng: 3 },
  ];

  it('removes excluded place ids', () => {
    expect(withoutExcludedPois(pois, ['b']).map((p) => p.placeId)).toEqual([
      'a',
      'c',
    ]);
  });

  it('returns all pois when exclusion list is empty', () => {
    expect(withoutExcludedPois(pois, [])).toEqual(pois);
  });

  it('returns empty when every poi is excluded', () => {
    expect(withoutExcludedPois(pois, ['a', 'b', 'c'])).toEqual([]);
  });
});

describe('pairsToRecomputeAfterExclude', () => {
  it('includes the source cell even when it was not in unlocked affected', () => {
    const pairs = pairsToRecomputeAfterExclude(
      [{ listing_id: 'l2', criterion_id: 'c1' }],
      { listing_id: 'l1', criterion_id: 'c1' },
    );
    expect(pairs).toEqual(
      expect.arrayContaining([
        { listing_id: 'l2', criterion_id: 'c1' },
        { listing_id: 'l1', criterion_id: 'c1' },
      ]),
    );
    expect(pairs).toHaveLength(2);
  });

  it('dedupes source when it is already unlocked-affected', () => {
    expect(
      pairsToRecomputeAfterExclude(
        [{ listing_id: 'l1', criterion_id: 'c1' }],
        { listing_id: 'l1', criterion_id: 'c1' },
      ),
    ).toEqual([{ listing_id: 'l1', criterion_id: 'c1' }]);
  });
});
