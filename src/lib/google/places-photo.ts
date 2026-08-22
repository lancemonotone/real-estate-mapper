import { requireEnv } from '../env';
import { formatGoogleApiError } from './format-api-error';

type PhotosResponse = {
  photos?: Array<{ name?: string }>;
};

function normalizePlaceId(id: string): string {
  return id.startsWith('places/') ? id.slice('places/'.length) : id;
}

/**
 * Returns the first Place Photo media URL (Google-hosted), or null if none.
 * Caller should fetch/proxy the URL — do not expose the API key in HTML.
 */
export async function resolvePlacePhotoName(placeId: string): Promise<string | null> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const id = normalizePlaceId(placeId.trim());
  if (!id) return null;

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'photos',
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatGoogleApiError(res.status, text, 'Place Photos'));
  }

  const data = (await res.json()) as PhotosResponse;
  const name = data.photos?.[0]?.name?.trim();
  return name || null;
}

/** Fetch photo bytes from Places Photo media endpoint. */
export async function fetchPlacePhotoBytes(
  photoName: string,
  maxPx: number,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const clamped = Math.min(480, Math.max(64, Math.round(maxPx)));
  const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  url.searchParams.set('maxHeightPx', String(clamped));
  url.searchParams.set('maxWidthPx', String(clamped));
  url.searchParams.set('key', key);

  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatGoogleApiError(res.status, text, 'Place Photo media'));
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const bytes = await res.arrayBuffer();
  return { bytes, contentType };
}
