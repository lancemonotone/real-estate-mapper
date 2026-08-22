import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE_RADIUS_MILES,
  isAllowedRadiusMiles,
  nearestAllowedRadiusMiles,
  milesToMeters,
} from '../src/lib/geo/locale-radius';

describe('locale-radius', () => {
  it('defaults to 10 miles', () => {
    expect(DEFAULT_LOCALE_RADIUS_MILES).toBe(10);
  });

  it('accepts only allowed options', () => {
    expect(isAllowedRadiusMiles(10)).toBe(true);
    expect(isAllowedRadiusMiles(15)).toBe(false);
  });

  it('snaps meters to nearest allowed miles', () => {
    expect(nearestAllowedRadiusMiles(milesToMeters(12))).toBe(10);
    expect(nearestAllowedRadiusMiles(milesToMeters(30))).toBe(25);
    expect(nearestAllowedRadiusMiles(milesToMeters(80))).toBe(100);
  });
});
