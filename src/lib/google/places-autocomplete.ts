import { requireEnv } from '../env';
import { formatGoogleApiError } from './format-api-error';

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  /** Present when resolved via Text Search (skip Places Details). */
  lat?: number;
  lng?: number;
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      place?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
};

function normalizePlaceId(id: string): string {
  return id.startsWith('places/') ? id.slice('places/'.length) : id;
}

export async function autocompletePlaces(input: {
  text: string;
  lat: number;
  lng: number;
  radiusM: number;
  sessionToken: string;
}): Promise<PlaceSuggestion[]> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const trimmed = input.text.trim();
  if (!trimmed) {
    return [];
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({
      input: trimmed,
      sessionToken: input.sessionToken,
      locationBias: {
        circle: {
          center: { latitude: input.lat, longitude: input.lng },
          radius: input.radiusM,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatGoogleApiError(res.status, text, 'Places Autocomplete'));
  }

  const data = (await res.json()) as AutocompleteResponse;
  const out: PlaceSuggestion[] = [];
  for (const suggestion of data.suggestions ?? []) {
    const pred = suggestion.placePrediction;
    if (!pred) continue;
    const rawId = pred.placeId ?? pred.place;
    if (!rawId) continue;
    const primary =
      pred.structuredFormat?.mainText?.text ?? pred.text?.text ?? '';
    const secondary = pred.structuredFormat?.secondaryText?.text ?? '';
    if (!primary) continue;
    out.push({
      placeId: normalizePlaceId(rawId),
      primaryText: primary,
      secondaryText: secondary,
    });
  }
  return out;
}
