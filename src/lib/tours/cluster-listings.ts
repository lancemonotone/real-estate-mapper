import { haversineMeters } from '../geo/haversine';
import { milesToMeters } from '../geo/locale-radius';

export const AUTO_PLAN_RADIUS_MILES = 3;
export const AUTO_PLAN_MAX_PER_CLUSTER = 6;

export type ClusterListingPoint = {
  id: string;
  lat: number;
  lng: number;
};

export type ClusterListingsOptions = {
  radiusM?: number;
  maxPerCluster?: number;
};

/**
 * Greedy proximity clusters: seed by sorted id, grow by nearest in-radius neighbor
 * until max size. Dates are assigned later by the user.
 */
export function clusterListingsByProximity(
  points: ClusterListingPoint[],
  options: ClusterListingsOptions = {},
): string[][] {
  const radiusM = options.radiusM ?? milesToMeters(AUTO_PLAN_RADIUS_MILES);
  const maxPerCluster = options.maxPerCluster ?? AUTO_PLAN_MAX_PER_CLUSTER;

  if (maxPerCluster < 1) {
    throw new Error('maxPerCluster must be at least 1');
  }

  const byId = new Map<string, ClusterListingPoint>();
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    byId.set(p.id, p);
  }

  const remaining = [...byId.keys()].sort();
  const clusters: string[][] = [];

  while (remaining.length > 0) {
    const seedId = remaining.shift()!;
    const cluster = [seedId];

    while (cluster.length < maxPerCluster && remaining.length > 0) {
      let bestIdx = -1;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < remaining.length; i++) {
        const candidateId = remaining[i]!;
        const candidate = byId.get(candidateId)!;
        let minDist = Number.POSITIVE_INFINITY;
        for (const memberId of cluster) {
          const member = byId.get(memberId)!;
          const d = haversineMeters(member, candidate);
          if (d < minDist) minDist = d;
        }
        if (minDist <= radiusM && minDist < bestDist) {
          bestDist = minDist;
          bestIdx = i;
        }
      }

      if (bestIdx < 0) break;
      cluster.push(remaining.splice(bestIdx, 1)[0]!);
    }

    clusters.push(cluster);
  }

  return clusters;
}
