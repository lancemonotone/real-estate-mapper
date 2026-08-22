import { describe, expect, it } from 'vitest';
import { shortlistPois } from '../src/lib/proximity/shortlist';

describe('shortlistPois', () => {
  it('returns nearest n by haversine', () => {
    const origin = { lat: 0, lng: 0 };
    const pois = [
      { placeId: 'far', name: 'Far', lat: 1, lng: 1 },
      { placeId: 'near', name: 'Near', lat: 0.01, lng: 0 },
      { placeId: 'mid', name: 'Mid', lat: 0.1, lng: 0 },
    ];
    const top = shortlistPois(origin, pois, 2);
    expect(top.map((p) => p.placeId)).toEqual(['near', 'mid']);
  });

  it('returns empty when no pois', () => {
    expect(shortlistPois({ lat: 0, lng: 0 }, [], 5)).toEqual([]);
  });
});
