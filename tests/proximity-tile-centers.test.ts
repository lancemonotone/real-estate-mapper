import { describe, expect, it } from 'vitest';
import {
  PLACES_MAX_RADIUS_M,
  tileSearchCenters,
} from '../src/lib/proximity/fill-pois';
import { haversineMeters } from '../src/lib/geo/haversine';

describe('tileSearchCenters', () => {
  const center = { lat: 40.0, lng: -75.0 };

  it('returns a single center when locale radius is within Places max', () => {
    const centers = tileSearchCenters(center, 25_000);
    expect(centers).toEqual([
      { lat: center.lat, lng: center.lng, radiusM: 25_000 },
    ]);
  });

  it('returns multiple 50km tiles when locale radius exceeds Places max', () => {
    const localeRadiusM = 80_467; // ~50 miles
    const centers = tileSearchCenters(center, localeRadiusM);
    expect(centers.length).toBeGreaterThan(1);
    expect(centers.every((c) => c.radiusM === PLACES_MAX_RADIUS_M)).toBe(true);
    expect(
      centers.some(
        (c) =>
          Math.abs(c.lat - center.lat) < 1e-9 &&
          Math.abs(c.lng - center.lng) < 1e-9,
      ),
    ).toBe(true);
    expect(
      centers.every(
        (c) => haversineMeters(center, c) <= localeRadiusM + 1,
      ),
    ).toBe(true);
  });
});
