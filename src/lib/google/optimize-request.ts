import { pickDestinationListingId } from '../geo/pick-destination';

export type OptimizeStop = {
  id: string;
  lat: number;
  lng: number;
  isStart: boolean;
};

function latLng(p: { lat: number; lng: number }) {
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

export function buildOptimizePlan(stops: OptimizeStop[]) {
  const starts = stops.filter((s) => s.isStart);
  if (starts.length !== 1) {
    throw new Error('Exactly one start listing is required');
  }
  if (stops.length < 2) {
    throw new Error('Optimize requires at least 2 geocoded stops');
  }

  const origin = starts[0]!;
  const destinationId = pickDestinationListingId(
    origin.id,
    stops.map(({ id, lat, lng }) => ({ id, lat, lng })),
  );
  const destination = stops.find((s) => s.id === destinationId)!;
  const intermediateIds = stops
    .filter((s) => s.id !== origin.id && s.id !== destinationId)
    .map((s) => s.id);

  return {
    originId: origin.id,
    destinationId,
    intermediateIds,
    body: {
      origin: latLng(origin),
      destination: latLng(destination),
      intermediates: intermediateIds.map((id) =>
        latLng(stops.find((s) => s.id === id)!),
      ),
      travelMode: 'DRIVE' as const,
      optimizeWaypointOrder: true as const,
    },
  };
}
