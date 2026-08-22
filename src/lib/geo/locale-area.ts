import { haversineMeters, type LatLng } from './haversine';

export type { LatLng };

export const DEFAULT_LOCALE_PADDING_M = 1000;
export const DEFAULT_NEW_LOCALE_RADIUS_M = 25_000;

export function centerFromPoints(points: LatLng[]): LatLng {
  if (points.length === 0) throw new Error('centerFromPoints: empty points');
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

export function radiusMetersToCover(
  center: LatLng,
  points: LatLng[],
  paddingM: number,
): number {
  if (points.length === 0) throw new Error('radiusMetersToCover: empty points');
  const max = Math.max(...points.map((p) => haversineMeters(center, p)));
  return max + paddingM;
}

export function expandRadiusToInclude(
  center: LatLng,
  radiusM: number,
  point: LatLng,
  paddingM: number,
): number {
  const d = haversineMeters(center, point);
  if (d <= radiusM) return radiusM;
  return d + paddingM;
}
