import { haversineMeters } from './haversine';
import type { LatLng } from './haversine';

export function pickFarthestPointId(
  origin: LatLng,
  points: Array<{ id: string; lat: number; lng: number }>,
): string {
  if (points.length < 1) {
    throw new Error('Optimize requires at least 1 geocoded stop');
  }

  let best = points[0]!;
  let bestDist = haversineMeters(origin, best);
  for (const p of points.slice(1)) {
    const d = haversineMeters(origin, p);
    if (d > bestDist || (d === bestDist && p.id < best.id)) {
      best = p;
      bestDist = d;
    }
  }
  return best.id;
}

export function pickDestinationListingId(
  startId: string,
  points: Array<{ id: string; lat: number; lng: number }>,
): string {
  const start = points.find((p) => p.id === startId);
  if (!start) throw new Error('Start listing not in points');
  const others = points.filter((p) => p.id !== startId);
  if (others.length < 1) {
    throw new Error('Optimize requires at least 2 geocoded stops');
  }
  return pickFarthestPointId(start, others);
}
