import { haversineMeters } from './haversine';

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

  let best = others[0]!;
  let bestDist = haversineMeters(start, best);
  for (const p of others.slice(1)) {
    const d = haversineMeters(start, p);
    if (d > bestDist || (d === bestDist && p.id < best.id)) {
      best = p;
      bestDist = d;
    }
  }
  return best.id;
}
