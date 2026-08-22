export const LOCALE_RADIUS_MILES_OPTIONS = [5, 10, 25, 50, 100] as const;
export type LocaleRadiusMiles = (typeof LOCALE_RADIUS_MILES_OPTIONS)[number];

export const DEFAULT_LOCALE_RADIUS_MILES: LocaleRadiusMiles = 10;

export const MILES_TO_METERS = 1609.344;

export function milesToMeters(miles: number): number {
  return miles * MILES_TO_METERS;
}

export function metersToMiles(meters: number): number {
  return meters / MILES_TO_METERS;
}

export function isAllowedRadiusMiles(miles: number): miles is LocaleRadiusMiles {
  return (LOCALE_RADIUS_MILES_OPTIONS as readonly number[]).includes(miles);
}

/** Snap stored radius to the nearest allowed select option. */
export function nearestAllowedRadiusMiles(meters: number): LocaleRadiusMiles {
  const miles = metersToMiles(meters);
  let best: LocaleRadiusMiles = DEFAULT_LOCALE_RADIUS_MILES;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const opt of LOCALE_RADIUS_MILES_OPTIONS) {
    const d = Math.abs(opt - miles);
    if (d < bestDist) {
      best = opt;
      bestDist = d;
    }
  }
  return best;
}
