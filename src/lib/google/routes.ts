import { requireEnv } from '../env';
import type { buildOptimizePlan } from './optimize-request';

type OptimizePlan = ReturnType<typeof buildOptimizePlan>;

export type RouteLeg = { durationSec: number; distanceM: number };

export type OptimizedRoute = {
  /** Listing ids in visit order (custom endpoints omitted). */
  orderedIds: string[];
  /** Full path ids including nulls for custom start/end slots. */
  fullPathIds: Array<string | null>;
  legs: RouteLeg[];
  encodedPolyline?: string;
};

function parseDurationSec(duration: string | { seconds?: string } | undefined): number {
  if (!duration) return 0;
  if (typeof duration === 'string') {
    const m = duration.match(/^(\d+)s$/);
    return m ? Number(m[1]) : 0;
  }
  return Number(duration.seconds ?? 0);
}

export async function computeOptimizedRoute(
  plan: OptimizePlan,
): Promise<OptimizedRoute> {
  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify(plan.body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Routes API HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    routes?: Array<{
      optimizedIntermediateWaypointIndex?: number[];
      legs?: Array<{ duration?: string; distanceMeters?: number }>;
      polyline?: { encodedPolyline?: string };
    }>;
  };

  const route = data.routes?.[0];
  if (!route) {
    throw new Error('Routes API returned no route');
  }

  const intermediateOrder = route.optimizedIntermediateWaypointIndex ?? [];
  const orderedIntermediateIds =
    intermediateOrder.length > 0
      ? intermediateOrder.map((i) => plan.intermediateIds[i]!)
      : [...plan.intermediateIds];

  const fullPathIds: Array<string | null> = [
    plan.originId,
    ...orderedIntermediateIds,
    plan.destinationId,
  ];
  const orderedIds = fullPathIds.filter((id): id is string => id != null);

  const legs: RouteLeg[] = (route.legs ?? []).map((leg) => ({
    durationSec: parseDurationSec(leg.duration),
    distanceM: leg.distanceMeters ?? 0,
  }));

  return {
    orderedIds,
    fullPathIds,
    legs,
    encodedPolyline: route.polyline?.encodedPolyline,
  };
}
