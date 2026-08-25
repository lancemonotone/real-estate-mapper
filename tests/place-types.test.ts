import { describe, expect, it } from 'vitest';
import {
  PLACE_TYPE_CATALOG,
  PLACE_TYPE_GROUPS,
  isPlaceTypeKey,
  placeTypeLabel,
} from '../src/lib/proximity/place-types';

describe('PLACE_TYPE_CATALOG (Table A)', () => {
  it('maps beach to nearby beach type', () => {
    expect(PLACE_TYPE_CATALOG.beach.strategy).toEqual({
      kind: 'nearby',
      includedTypes: ['beach'],
    });
  });

  it('uses grocery_store and transit_station Google ids', () => {
    expect(isPlaceTypeKey('grocery')).toBe(false);
    expect(isPlaceTypeKey('transit')).toBe(false);
    expect(PLACE_TYPE_CATALOG.grocery_store.strategy).toEqual({
      kind: 'nearby',
      includedTypes: ['grocery_store'],
    });
    expect(PLACE_TYPE_CATALOG.transit_station.strategy).toEqual({
      kind: 'nearby',
      includedTypes: ['transit_station'],
    });
  });

  it('exposes grouped Table A types without duplicate keys', () => {
    const keys = PLACE_TYPE_GROUPS.flatMap((g) => g.types.map((t) => t.key));
    expect(keys.length).toBeGreaterThan(100);
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.keys(PLACE_TYPE_CATALOG).length).toBe(keys.length);
  });

  it('humanizes labels for the UI', () => {
    expect(placeTypeLabel('dog_park')).toBe('Dog Park');
    expect(placeTypeLabel('grocery_store')).toBe('Grocery Store');
  });
});
