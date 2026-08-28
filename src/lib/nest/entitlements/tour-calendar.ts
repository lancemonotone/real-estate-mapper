import { PLAN_LIMITS } from './constants';
import { PLAN_MESSAGES } from './messages';
import type { NestEntitlementSnapshot } from './types';
export type TourCalendarDayRow = { id: string; tour_date: string };
export type TourCalendarStopRow = { tour_day_id: string; listing_id: string };

export type TourDropBlockReason = 'cap' | 'hidden';

export type TourCalendarDayMeta = {
  id: string;
  stopCount: number;
  visible: boolean;
};

export type TourCalendarContext = {
  canAddNewTourDay: boolean;
  tourDayCap: number | null;
  capMessage: string;
  hiddenMessage: string;
  dropBlockedByDate: Record<string, { reason: TourDropBlockReason; message: string }>;
  assignedListingIds: Set<string>;
  assignedOnVisibleDayIds: Set<string>;
  assignedOnHiddenDayIds: Set<string>;
  allDaysByDate: Record<string, TourCalendarDayMeta>;
};

export type TourDropDecision =
  | { ok: true; action: 'assign-new' | 'merge' }
  | { ok: false; message: string };

export function buildTourCalendarContext(
  snapshot: NestEntitlementSnapshot,
  tourDays: TourCalendarDayRow[],
  stops: TourCalendarStopRow[],
): TourCalendarContext {
  const cap = PLAN_LIMITS[snapshot.plan].tourDaysWithStops;
  const canAddNewTourDay = cap === null || snapshot.tourDaysWithStopsCount < cap;

  const capMessage = PLAN_MESSAGES.tourDayCap(snapshot.plan);
  const hiddenMessage = PLAN_MESSAGES.tourDayHiddenDrop;
  const stopCountByDayId = new Map<string, number>();
  const listingsByDayId = new Map<string, Set<string>>();
  for (const stop of stops) {
    stopCountByDayId.set(
      stop.tour_day_id,
      (stopCountByDayId.get(stop.tour_day_id) ?? 0) + 1,
    );
    const ids = listingsByDayId.get(stop.tour_day_id) ?? new Set<string>();
    ids.add(stop.listing_id);
    listingsByDayId.set(stop.tour_day_id, ids);
  }

  const assignedListingIds = new Set(stops.map((stop) => stop.listing_id));
  const assignedOnVisibleDayIds = new Set<string>();
  const assignedOnHiddenDayIds = new Set<string>();

  for (const day of tourDays) {
    const ids = listingsByDayId.get(day.id);
    if (!ids) continue;
    const bucket = snapshot.visibleTourDayIds.has(day.id)
      ? assignedOnVisibleDayIds
      : assignedOnHiddenDayIds;
    for (const id of ids) bucket.add(id);
  }

  const allDaysByDate: Record<string, TourCalendarDayMeta> = {};
  const dropBlockedByDate: TourCalendarContext['dropBlockedByDate'] = {};

  for (const day of tourDays) {
    const stopCount = stopCountByDayId.get(day.id) ?? 0;
    const visible = snapshot.visibleTourDayIds.has(day.id);
    allDaysByDate[day.tour_date] = { id: day.id, stopCount, visible };
    if (stopCount > 0 && !visible) {
      dropBlockedByDate[day.tour_date] = { reason: 'hidden', message: hiddenMessage };
    }
  }

  return {
    canAddNewTourDay,
    tourDayCap: cap,
    capMessage,
    hiddenMessage,
    dropBlockedByDate,
    assignedListingIds,
    assignedOnVisibleDayIds,
    assignedOnHiddenDayIds,
    allDaysByDate,
  };
}

export function resolveTourDrop(
  ctx: TourCalendarContext,
  tourDate: string,
): TourDropDecision {
  const blocked = ctx.dropBlockedByDate[tourDate];
  if (blocked) {
    return { ok: false, message: blocked.message };
  }

  const meta = ctx.allDaysByDate[tourDate];
  const stopCount = meta?.stopCount ?? 0;

  if (stopCount > 0) {
    if (!meta.visible) {
      return { ok: false, message: ctx.hiddenMessage };
    }
    return { ok: true, action: 'merge' };
  }

  if (!ctx.canAddNewTourDay) {
    return { ok: false, message: ctx.capMessage };
  }

  return { ok: true, action: 'assign-new' };
}

export function tourCalendarClientConfig(ctx: TourCalendarContext) {
  return {
    canAddNewTourDay: ctx.canAddNewTourDay,
    capMessage: ctx.capMessage,
    hiddenMessage: ctx.hiddenMessage,
    allDaysByDate: ctx.allDaysByDate,
    dropBlockedByDate: ctx.dropBlockedByDate,
  };
}
