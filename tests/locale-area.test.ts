import { describe, expect, it } from 'vitest';
import {
  centerFromPoints,
  expandRadiusToInclude,
  radiusMetersToCover,
} from '../src/lib/geo/locale-area';

describe('locale-area', () => {
  it('centerFromPoints averages coordinates', () => {
    expect(
      centerFromPoints([
        { lat: 0, lng: 0 },
        { lat: 2, lng: 4 },
      ]),
    ).toEqual({ lat: 1, lng: 2 });
  });

  it('centerFromPoints throws on empty', () => {
    expect(() => centerFromPoints([])).toThrow(/empty/i);
  });

  it('radiusMetersToCover includes farthest point plus padding', () => {
    const center = { lat: 0, lng: 0 };
    const r = radiusMetersToCover(center, [{ lat: 0, lng: 0.01 }], 1000);
    expect(r).toBeGreaterThan(1000);
  });

  it('expandRadiusToInclude grows only when outside', () => {
    const center = { lat: 26.7, lng: -80.0 };
    expect(expandRadiusToInclude(center, 5000, center, 1000)).toBe(5000);
    const grown = expandRadiusToInclude(
      center,
      100,
      { lat: 26.8, lng: -80.0 },
      1000,
    );
    expect(grown).toBeGreaterThan(100);
  });
});
