import { requireEnv } from '../env';
import { formatGoogleApiError } from './format-api-error';

export type PlaceDetails = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};

type PlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
};

function normalizePlaceId(id: string): string {
  return id.startsWith('places/') ? id.slice('places/'.length) : id;
}

export async function fetchPlaceDetails(input: {
  placeId: string;
  sessionToken?: string;
}): Promise<PlaceDetails> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const placeId = normalizePlaceId(input.placeId.trim());
  if (!placeId) {
    throw new Error('place_id required');
  }

  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
  );
  if (input.sessionToken) {
    url.searchParams.set('sessionToken', input.sessionToken);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'id,displayName,location',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatGoogleApiError(res.status, text, 'Place Details'));
  }

  const data = (await res.json()) as PlaceDetailsResponse;
  const name = data.displayName?.text?.trim();
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  const id = data.id ? normalizePlaceId(data.id) : placeId;

  if (!name || lat == null || lng == null) {
    throw new Error('Place Details missing name or coordinates');
  }

  return { placeId: id, name, lat, lng };
}
