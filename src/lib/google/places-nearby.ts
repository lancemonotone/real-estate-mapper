import { requireEnv } from '../env';
import type { PoiCandidate } from '../proximity/place-types';

type PlacesNearbyResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  }>;
};

const FIELD_MASK = 'places.id,places.displayName,places.location';

export async function searchNearbyPlaces(input: {
  lat: number;
  lng: number;
  radiusM: number;
  includedTypes: string[];
  maxResultCount?: number;
}): Promise<PoiCandidate[]> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');

  const body: Record<string, unknown> = {
    includedTypes: input.includedTypes,
    locationRestriction: {
      circle: {
        center: { latitude: input.lat, longitude: input.lng },
        radius: input.radiusM,
      },
    },
  };
  if (input.maxResultCount != null) {
    body.maxResultCount = input.maxResultCount;
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places Nearby HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as PlacesNearbyResponse;
  return mapPlaces(data.places ?? []);
}

function mapPlaces(
  places: NonNullable<PlacesNearbyResponse['places']>,
): PoiCandidate[] {
  const out: PoiCandidate[] = [];
  for (const place of places) {
    const placeId = place.id;
    const name = place.displayName?.text;
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (!placeId || !name || lat == null || lng == null) {
      continue;
    }
    out.push({ placeId, name, lat, lng });
  }
  return out;
}
