import { haversineMeters } from '../geo/haversine';
import {
  AUTO_PLAN_MAX_PER_CLUSTER,
  AUTO_PLAN_RADIUS_MILES,
} from './cluster-listings';
import { milesToMeters } from '../geo/locale-radius';

export type FillPoint = {
  id: string;
  lat: number;
  lng: number;
};

export type FillExistingStop = {
  listingId: string;
  lat: number;
  lng: number;
};

export type FillAssignment = {
  tourDate: string;
  listingIds: string[];
  /** True if the day already had stops before this plan. */
  merge: boolean;
};

export type PlanFillDateRangeInput = {
  rangeDates: string[];
  existingByDate: Record<string, FillExistingStop[]>;
  unscheduled: FillPoint[];
  radiusM?: number;
  maxPerDay?: number;
};

export type PlanFillDateRangeResult = {
  assignments: FillAssignment[];
  overflowIds: string[];
};

type DayState = {
  date: string;
  hadExisting: boolean;
  count: number;
  points: { lat: number; lng: number }[];
  addedIds: string[];
};

function dayIsProximate(
  listing: FillPoint,
  day: DayState,
  radiusM: number,
): boolean {
  if (day.points.length === 0) return true;
  return day.points.some(
    (p) => haversineMeters(listing, p) <= radiusM,
  );
}

/**
 * Spread-first fill: assign unscheduled listings onto dates in range.
 * Eligible day = under maxPerDay and (empty or within radius of a stop).
 * Prefer lower count, then proximate, then earlier date.
 */
export function planFillDateRange(
  input: PlanFillDateRangeInput,
): PlanFillDateRangeResult {
  const radiusM =
    input.radiusM ?? milesToMeters(AUTO_PLAN_RADIUS_MILES);
  const maxPerDay = input.maxPerDay ?? AUTO_PLAN_MAX_PER_CLUSTER;

  if (maxPerDay < 1) {
    throw new Error('maxPerDay must be at least 1');
  }
  if (input.rangeDates.length === 0) {
    throw new Error('rangeDates required');
  }

  const days: DayState[] = input.rangeDates.map((date) => {
    const existing = input.existingByDate[date] ?? [];
    const geocoded = existing.filter(
      (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
    );
    return {
      date,
      hadExisting: existing.length > 0,
      count: existing.length,
      points: geocoded.map((s) => ({ lat: s.lat, lng: s.lng })),
      addedIds: [],
    };
  });

  const overflowIds: string[] = [];
  const unscheduled = [...input.unscheduled]
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const listing of unscheduled) {
    const eligible = days.filter(
      (day) =>
        day.count < maxPerDay && dayIsProximate(listing, day, radiusM),
    );

    if (eligible.length === 0) {
      overflowIds.push(listing.id);
      continue;
    }

    eligible.sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      const aProx =
        a.points.length === 0 ||
        a.points.some((p) => haversineMeters(listing, p) <= radiusM);
      const bProx =
        b.points.length === 0 ||
        b.points.some((p) => haversineMeters(listing, p) <= radiusM);
      // Prefer days that already have a nearby stop (merge) over empty when counts tie
      // Empty is proximate=true via dayIsProximate; treat empty as less preferred than
      // a non-empty proximate day when counts equal so we merge when loads match.
      const aMerge = a.points.length > 0 && aProx ? 0 : 1;
      const bMerge = b.points.length > 0 && bProx ? 0 : 1;
      if (aMerge !== bMerge) return aMerge - bMerge;
      return a.date.localeCompare(b.date);
    });

    const pick = eligible[0]!;
    pick.count += 1;
    pick.points.push({ lat: listing.lat, lng: listing.lng });
    pick.addedIds.push(listing.id);
  }

  const assignments: FillAssignment[] = days
    .filter((d) => d.addedIds.length > 0)
    .map((d) => ({
      tourDate: d.date,
      listingIds: d.addedIds,
      merge: d.hadExisting,
    }));

  return { assignments, overflowIds };
}
