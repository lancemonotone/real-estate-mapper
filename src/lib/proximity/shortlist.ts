import { haversineMeters } from '../geo/haversine';
import { PROXIMITY_SHORTLIST_N, type PoiCandidate } from './place-types';

export function shortlistPois(
  origin: { lat: number; lng: number },
  pois: PoiCandidate[],
  n: number,
): PoiCandidate[] {
  if (pois.length === 0) {
    return [];
  }

  const limit = Math.min(Math.max(n, 0), PROXIMITY_SHORTLIST_N);

  return [...pois]
    .sort(
      (a, b) =>
        haversineMeters(origin, a) - haversineMeters(origin, b),
    )
    .slice(0, limit);
}
