import { requireEnv } from '../env';
import type { MatrixLeg } from '../proximity/pick-winner';

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';

export type { MatrixLeg };

export type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  status?: { code?: number; message?: string };
  condition?: string;
  distanceMeters?: number;
  duration?: string | { seconds?: string };
};

export function parseDurationSec(
  duration: string | { seconds?: string } | undefined,
): number {
  if (!duration) {
    throw new Error('Route matrix duration is missing');
  }
  if (typeof duration === 'string') {
    const m = duration.match(/^(\d+(?:\.\d+)?)s$/);
    if (!m) {
      throw new Error(`Unparseable route duration: ${duration}`);
    }
    return Number(m[1]);
  }
  if (duration.seconds == null || duration.seconds === '') {
    throw new Error('Route matrix duration.seconds is missing');
  }
  return Number(duration.seconds);
}

export function mapRouteMatrixElements(
  elements: RouteMatrixElement[],
): MatrixLeg[] {
  return elements.map((el) => {
    const destinationIndex = el.destinationIndex;
    if (destinationIndex == null) {
      throw new Error('Route matrix element missing destinationIndex');
    }

    const ok = el.condition === 'ROUTE_EXISTS';
    if (!ok) {
      return {
        destinationIndex,
        durationSec: 0,
        distanceM: 0,
        ok: false,
      };
    }

    if (el.distanceMeters == null) {
      throw new Error('Route matrix distanceMeters is missing');
    }

    return {
      destinationIndex,
      durationSec: parseDurationSec(el.duration),
      distanceM: el.distanceMeters,
      ok: true,
    };
  });
}

export async function computeRouteMatrix(input: {
  origin: { lat: number; lng: number };
  destinations: Array<{ lat: number; lng: number }>;
  travelMode: TravelMode;
}): Promise<MatrixLeg[]> {
  if (input.destinations.length === 0) {
    throw new Error('computeRouteMatrix requires at least one destination');
  }

  const key = requireEnv('GOOGLE_MAPS_API_KEY');
  const waypoint = (lat: number, lng: number) => ({
    waypoint: {
      location: {
        latLng: { latitude: lat, longitude: lng },
      },
    },
  });

  const res = await fetch(
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'originIndex,destinationIndex,duration,distanceMeters,status,condition',
      },
      body: JSON.stringify({
        origins: [waypoint(input.origin.lat, input.origin.lng)],
        destinations: input.destinations.map((d) => waypoint(d.lat, d.lng)),
        travelMode: input.travelMode,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Route Matrix HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as RouteMatrixElement[];
  if (!Array.isArray(data)) {
    throw new Error('Route Matrix response is not an array');
  }

  return mapRouteMatrixElements(data);
}
