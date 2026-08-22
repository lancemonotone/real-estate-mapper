import { requireEnv } from '../env';
import type { PoiCandidate } from '../proximity/place-types';

type PlacesTextResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  }>;
};

const FIELD_MASK = 'places.id,places.displayName,places.location';

export async function searchTextPlaces(input: {
  lat: number;
  lng: number;
  radiusM: number;
  textQuery: string;
  maxResultCount?: number;
}): Promise<PoiCandidate[]> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');

  const body: Record<string, unknown> = {
    textQuery: input.textQuery,
    locationBias: {
      circle: {
        center: { latitude: input.lat, longitude: input.lng },
        radius: input.radiusM,
      },
    },
  };
  if (input.maxResultCount != null) {
    body.maxResultCount = input.maxResultCount;
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
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
    throw new Error(`Places Text HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as PlacesTextResponse;
  return mapPlaces(data.places ?? []);
}

function mapPlaces(
  places: NonNullable<PlacesTextResponse['places']>,
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
