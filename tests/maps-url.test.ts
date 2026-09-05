import { describe, expect, it } from 'vitest';
import {
  GOOGLE_MAPS_MAX_WAYPOINTS,
  googleMapsDayDirectionsUrl,
  googleMapsDirectionsUrl,
  normalizePlaceId,
} from '../src/lib/proximity/maps-url';

describe('maps-url', () => {
  it('strips places/ prefix from New Places ids', () => {
    expect(normalizePlaceId('places/ChIJabc')).toBe('ChIJabc');
    expect(normalizePlaceId('ChIJabc')).toBe('ChIJabc');
  });

  it('builds a directions URL from listing origin to place', () => {
    const url = googleMapsDirectionsUrl({
      origin: { lat: 28.0, lng: -82.8 },
      destination: {
        lat: 27.97,
        lng: -82.83,
        placeId: 'places/ChIJbeach',
        name: 'Vicky Beach',
      },
      travelMode: 'DRIVE',
    });
    expect(url).toContain('https://www.google.com/maps/dir/?');
    expect(url).toContain('origin=28%2C-82.8');
    expect(url).toContain('destination_place_id=ChIJbeach');
    expect(url).toContain('travelmode=driving');
  });

  it('builds a multi-stop day directions URL', () => {
    const result = googleMapsDayDirectionsUrl([
      { lat: 28.0, lng: -82.8 },
      { lat: 28.1, lng: -82.7 },
      { lat: 28.2, lng: -82.6 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain('origin=28%2C-82.8');
    expect(result.url).toContain('destination=28.2%2C-82.6');
    expect(result.url).toContain('waypoints=28.1%2C-82.7');
    expect(result.url).toContain('travelmode=driving');
  });

  it('rejects too few points and too many waypoints', () => {
    expect(googleMapsDayDirectionsUrl([{ lat: 1, lng: 2 }])).toEqual({
      ok: false,
      reason: 'too_few_points',
    });
    const many = Array.from({ length: GOOGLE_MAPS_MAX_WAYPOINTS + 3 }, (_, i) => ({
      lat: i,
      lng: i,
    }));
    expect(googleMapsDayDirectionsUrl(many)).toEqual({
      ok: false,
      reason: 'too_many_waypoints',
    });
  });
});
