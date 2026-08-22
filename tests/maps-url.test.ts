import { describe, expect, it } from 'vitest';
import { googleMapsDirectionsUrl, normalizePlaceId } from '../src/lib/proximity/maps-url';

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
});
