import { describe, expect, it } from 'vitest';
import { selectUnscheduledGeocodedForAutoPlan } from '../src/lib/tours/auto-plan-pool';

describe('selectUnscheduledGeocodedForAutoPlan', () => {
  const listings = [
    { id: 'a', lat: 1, lng: 2, is_favorite: true },
    { id: 'b', lat: 3, lng: 4, is_favorite: false },
    { id: 'c', lat: null, lng: null, is_favorite: true },
    { id: 'd', lat: 5, lng: 6, is_favorite: true },
  ];

  it('returns all unscheduled geocoded when favoritesOnly is false', () => {
    const result = selectUnscheduledGeocodedForAutoPlan(listings, new Set(['d']), {
      favoritesOnly: false,
    });
    expect(result.geocoded.map((l) => l.id)).toEqual(['a', 'b']);
    expect(result.skippedMissingGeo).toBe(1);
    expect(result.skippedNotFavorite).toBe(0);
  });

  it('keeps only favorited unscheduled geocoded when favoritesOnly is true', () => {
    const result = selectUnscheduledGeocodedForAutoPlan(listings, new Set(), {
      favoritesOnly: true,
    });
    expect(result.geocoded.map((l) => l.id)).toEqual(['a']);
    expect(result.skippedMissingGeo).toBe(1);
    expect(result.skippedNotFavorite).toBe(1);
  });

  it('defaults favoritesOnly to false', () => {
    const result = selectUnscheduledGeocodedForAutoPlan(listings, new Set());
    expect(result.geocoded.map((l) => l.id)).toEqual(['a', 'b', 'd']);
  });
});
