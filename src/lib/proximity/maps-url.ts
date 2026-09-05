import type { TravelMode } from '../types/database';

/** Strip Places API (New) resource prefix if present. */
export function normalizePlaceId(placeId: string | null | undefined): string | null {
  if (!placeId) return null;
  return placeId.startsWith('places/') ? placeId.slice('places/'.length) : placeId;
}

const TRAVELMODE: Record<TravelMode, string> = {
  DRIVE: 'driving',
  WALK: 'walking',
  BICYCLE: 'bicycling',
  TRANSIT: 'transit',
};

/**
 * Google Maps directions URL from listing origin to a place/coords.
 * @see https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function googleMapsDirectionsUrl(input: {
  origin: { lat: number; lng: number };
  destination: {
    lat: number;
    lng: number;
    placeId?: string | null;
    name?: string | null;
  };
  travelMode: TravelMode;
}): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${input.origin.lat},${input.origin.lng}`,
    travelmode: TRAVELMODE[input.travelMode],
  });

  const placeId = normalizePlaceId(input.destination.placeId);
  if (placeId) {
    params.set(
      'destination',
      input.destination.name?.trim() || `${input.destination.lat},${input.destination.lng}`,
    );
    params.set('destination_place_id', placeId);
  } else {
    params.set(
      'destination',
      `${input.destination.lat},${input.destination.lng}`,
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Google Maps URL Directions: max intermediate waypoints (desktop); mobile may show fewer. */
export const GOOGLE_MAPS_MAX_WAYPOINTS = 9;

export type MapsLatLng = { lat: number; lng: number };

export type GoogleMapsDayDirectionsResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'too_few_points' | 'too_many_waypoints' };

/**
 * Multi-stop Google Maps directions URL (origin → waypoints → destination).
 * Points are visit order including optional custom start/end.
 * @see https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function googleMapsDayDirectionsUrl(
  points: MapsLatLng[],
  travelMode: TravelMode = 'DRIVE',
): GoogleMapsDayDirectionsResult {
  if (points.length < 2) {
    return { ok: false, reason: 'too_few_points' };
  }
  const origin = points[0]!;
  const destination = points[points.length - 1]!;
  const waypoints = points.slice(1, -1);
  if (waypoints.length > GOOGLE_MAPS_MAX_WAYPOINTS) {
    return { ok: false, reason: 'too_many_waypoints' };
  }

  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: TRAVELMODE[travelMode],
  });
  if (waypoints.length > 0) {
    params.set(
      'waypoints',
      waypoints.map((p) => `${p.lat},${p.lng}`).join('|'),
    );
  }
  return { ok: true, url: `https://www.google.com/maps/dir/?${params.toString()}` };
}

/** @deprecated Prefer googleMapsDirectionsUrl — place-only links omit the listing origin. */
export function googleMapsPlaceUrl(placeId: string): string {
  const id = normalizePlaceId(placeId) ?? placeId;
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(id)}`;
}

/** @deprecated Prefer googleMapsDirectionsUrl. */
export function googleMapsCoordUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
