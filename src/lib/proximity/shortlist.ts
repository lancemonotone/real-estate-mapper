import { haversineMeters } from '../geo/haversine';
import type { PoiCandidate } from './place-types';

export function shortlistPois(
  origin: { lat: number; lng: number },
  pois: PoiCandidate[],
  n: number,
): PoiCandidate[] {
  if (pois.length === 0) {
    return [];
  }

  return [...pois]
    .sort(
      (a, b) =>
        haversineMeters(origin, a) - haversineMeters(origin, b),
    )
    .slice(0, n);
}
