import { requireEnv } from '../env';

export type GeocodeResult = { lat: number; lng: number };

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', trimmed);
  url.searchParams.set('key', key);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };

  if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
    return null;
  }
  if (data.status !== 'OK') {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const loc = data.results[0]!.geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}
