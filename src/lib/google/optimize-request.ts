import { pickDestinationListingId, pickFarthestPointId } from '../geo/pick-destination';

export type OptimizeStop = {
  id: string;
  lat: number;
  lng: number;
  isStart: boolean;
};

export type CustomEndpoint = {
  lat: number;
  lng: number;
};

export type OptimizePlanOptions = {
  customStart?: CustomEndpoint | null;
  customEnd?: CustomEndpoint | null;
};

function latLng(p: { lat: number; lng: number }) {
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

/**
 * Build a Routes API plan.
 * - customStart / customEnd are optional non-listing endpoints.
 * - If customStart is missing, exactly one listing must be isStart (property start).
 * - If customEnd is missing, destination is a property (farthest from origin).
 */
export function buildOptimizePlan(
  stops: OptimizeStop[],
  options: OptimizePlanOptions = {},
) {
  if (stops.length < 1) {
    throw new Error('Optimize requires at least 1 geocoded listing');
  }

  const customStart = options.customStart ?? null;
  const customEnd = options.customEnd ?? null;

  let originPoint: { lat: number; lng: number };
  let originId: string | null = null;
  let destinationPoint: { lat: number; lng: number };
  let destinationId: string | null = null;
  let intermediateIds: string[] = [];

  if (customStart) {
    originPoint = customStart;
    originId = null;

    if (customEnd) {
      destinationPoint = customEnd;
      destinationId = null;
      intermediateIds = stops.map((s) => s.id);
    } else {
      if (stops.length < 1) {
        throw new Error('Optimize requires at least 1 geocoded listing');
      }
      destinationId = pickFarthestPointId(
        customStart,
        stops.map(({ id, lat, lng }) => ({ id, lat, lng })),
      );
      const destination = stops.find((s) => s.id === destinationId)!;
      destinationPoint = destination;
      intermediateIds = stops.filter((s) => s.id !== destinationId).map((s) => s.id);
    }
  } else {
    const starts = stops.filter((s) => s.isStart);
    if (starts.length === 0 && stops.length === 1) {
      // Single listing: treat it as the start property
      starts.push({ ...stops[0]!, isStart: true });
    }
    if (starts.length !== 1) {
      throw new Error('Exactly one start listing is required when no custom start is set');
    }

    const origin = starts[0]!;
    originPoint = origin;
    originId = origin.id;

    if (customEnd) {
      destinationPoint = customEnd;
      destinationId = null;
      intermediateIds = stops.filter((s) => s.id !== origin.id).map((s) => s.id);
    } else {
      if (stops.length < 2) {
        throw new Error('Optimize requires at least 2 geocoded listings when no custom end is set');
      }
      destinationId = pickDestinationListingId(
        origin.id,
        stops.map(({ id, lat, lng }) => ({ id, lat, lng })),
      );
      const destination = stops.find((s) => s.id === destinationId)!;
      destinationPoint = destination;
      intermediateIds = stops
        .filter((s) => s.id !== origin.id && s.id !== destinationId)
        .map((s) => s.id);
    }
  }

  return {
    originId,
    destinationId,
    intermediateIds,
    customStart: Boolean(customStart),
    customEnd: Boolean(customEnd),
    body: {
      origin: latLng(originPoint),
      destination: latLng(destinationPoint),
      intermediates: intermediateIds.map((id) =>
        latLng(stops.find((s) => s.id === id)!),
      ),
      travelMode: 'DRIVE' as const,
      optimizeWaypointOrder: true as const,
    },
  };
}

export type FixedOrderStop = {
  id: string;
  lat: number;
  lng: number;
};

/**
 * Routes plan that visits listings in the given order (no waypoint reordering).
 * customStart / customEnd wrap the path when set.
 */
export function buildFixedOrderPlan(
  stopsInVisitOrder: FixedOrderStop[],
  options: OptimizePlanOptions = {},
) {
  if (stopsInVisitOrder.length < 1) {
    throw new Error('Fixed-order route requires at least 1 geocoded listing');
  }

  const customStart = options.customStart ?? null;
  const customEnd = options.customEnd ?? null;
  const byId = new Map(stopsInVisitOrder.map((s) => [s.id, s]));

  let originPoint: { lat: number; lng: number };
  let originId: string | null;
  let destinationPoint: { lat: number; lng: number };
  let destinationId: string | null;
  let intermediateIds: string[];

  if (customStart) {
    originPoint = customStart;
    originId = null;
    if (customEnd) {
      destinationPoint = customEnd;
      destinationId = null;
      intermediateIds = stopsInVisitOrder.map((s) => s.id);
    } else {
      const last = stopsInVisitOrder[stopsInVisitOrder.length - 1]!;
      destinationPoint = last;
      destinationId = last.id;
      intermediateIds = stopsInVisitOrder.slice(0, -1).map((s) => s.id);
    }
  } else {
    const first = stopsInVisitOrder[0]!;
    originPoint = first;
    originId = first.id;
    if (customEnd) {
      destinationPoint = customEnd;
      destinationId = null;
      intermediateIds = stopsInVisitOrder.slice(1).map((s) => s.id);
    } else if (stopsInVisitOrder.length === 1) {
      destinationPoint = first;
      destinationId = first.id;
      intermediateIds = [];
    } else {
      const last = stopsInVisitOrder[stopsInVisitOrder.length - 1]!;
      destinationPoint = last;
      destinationId = last.id;
      intermediateIds = stopsInVisitOrder.slice(1, -1).map((s) => s.id);
    }
  }

  return {
    originId,
    destinationId,
    intermediateIds,
    customStart: Boolean(customStart),
    customEnd: Boolean(customEnd),
    body: {
      origin: latLng(originPoint),
      destination: latLng(destinationPoint),
      intermediates: intermediateIds.map((id) => latLng(byId.get(id)!)),
      travelMode: 'DRIVE' as const,
      optimizeWaypointOrder: false as const,
    },
  };
}
