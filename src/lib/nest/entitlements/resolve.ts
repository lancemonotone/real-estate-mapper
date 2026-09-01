import {
  ENTITLEMENT_ERROR_CODE,
  HUNT_PASS_DAYS,
  PLAN_LIMITS,
  PROXIMITY_REFRESH_PER_PASS,
  type EntitlementGate,
  type EntitlementPlan,
} from './constants';
import { PLAN_MESSAGES } from './messages';
import type {
  EntitlementAllow,
  EntitlementDenial,
  ListingRow,
  LocaleRow,
  NestBillingRow,
  NestEntitlementSnapshot,
  TourDayRow,
} from './types';

export function isNestPro(billing: NestBillingRow, now = new Date()): boolean {
  if (!billing.pass_expires_at) return false;
  return new Date(billing.pass_expires_at) > now;
}

export function resolveNestPlan(billing: NestBillingRow, now = new Date()): EntitlementPlan {
  return isNestPro(billing, now) ? 'pro' : 'free';
}

/** Synthetic billing for developer Hunt Pass preview (no Stripe). */
export function devHuntPassPreviewBilling(now = new Date()): NestBillingRow {
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + HUNT_PASS_DAYS);
  return {
    pass_started_at: now.toISOString(),
    pass_expires_at: expires.toISOString(),
    proximity_refresh_granted: PROXIMITY_REFRESH_PER_PASS,
    proximity_refresh_used: 0,
  };
}

function selectOldestIds<T extends { id: string; created_at: string }>(
  rows: T[],
  limit: number | null,
): Set<string> {
  if (limit === null || rows.length <= limit) {
    return new Set(rows.map((row) => row.id));
  }
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return new Set(sorted.slice(0, limit).map((row) => row.id));
}

export function resolveVisibleLocaleIds(locales: LocaleRow[], plan: EntitlementPlan): Set<string> {
  return selectOldestIds(locales, PLAN_LIMITS[plan].locales);
}

export function resolveVisibleListingIds(
  listings: ListingRow[],
  visibleLocaleIds: Set<string>,
  plan: EntitlementPlan,
): Set<string> {
  const active = listings.filter(
    (listing) => !listing.archived_at && visibleLocaleIds.has(listing.locale_id),
  );
  return selectOldestIds(active, PLAN_LIMITS[plan].listings);
}

export function resolveVisibleTourDayIds(
  tourDays: TourDayRow[],
  visibleLocaleIds: Set<string>,
  plan: EntitlementPlan,
): Set<string> {
  const withStops = tourDays.filter(
    (day) => day.stop_count > 0 && visibleLocaleIds.has(day.locale_id),
  );
  return selectOldestIds(withStops, PLAN_LIMITS[plan].tourDaysWithStops);
}

export function countActiveListingsForCap(
  listings: ListingRow[],
  visibleLocaleIds: Set<string>,
  plan: EntitlementPlan,
): number {
  const active = listings.filter((listing) => !listing.archived_at);
  if (plan === 'pro') return active.length;
  return active.filter((listing) => visibleLocaleIds.has(listing.locale_id)).length;
}

export function countTourDaysWithStopsForCap(
  tourDays: TourDayRow[],
  visibleLocaleIds: Set<string>,
  plan: EntitlementPlan,
): number {
  const withStops = tourDays.filter((day) => day.stop_count > 0);
  if (plan === 'pro') return withStops.length;
  return withStops.filter((day) => visibleLocaleIds.has(day.locale_id)).length;
}

export function proximityRefreshRemaining(billing: NestBillingRow, plan: EntitlementPlan): number {
  if (plan !== 'pro') return 0;
  return Math.max(0, billing.proximity_refresh_granted - billing.proximity_refresh_used);
}

export function countRouteSearchColumnsForCap(
  criteria: Array<{ locale_id: string }>,
  visibleLocaleIds: Set<string>,
): number {
  return criteria.filter((row) => visibleLocaleIds.has(row.locale_id)).length;
}

export function resolveNestEntitlements(input: {
  billing: NestBillingRow;
  locales: LocaleRow[];
  listings: ListingRow[];
  tourDays: TourDayRow[];
  routeSearchCriteria?: Array<{ locale_id: string }>;
  now?: Date;
}): NestEntitlementSnapshot {
  const plan = resolveNestPlan(input.billing, input.now);
  const visibleLocaleIds = resolveVisibleLocaleIds(input.locales, plan);
  const visibleListingIds = resolveVisibleListingIds(
    input.listings,
    visibleLocaleIds,
    plan,
  );
  const visibleTourDayIds = resolveVisibleTourDayIds(
    input.tourDays,
    visibleLocaleIds,
    plan,
  );

  const activeListings = input.listings.filter((listing) => !listing.archived_at);
  const tourDaysWithStops = input.tourDays.filter((day) => day.stop_count > 0);

  return {
    plan,
    billing: input.billing,
    visibleLocaleIds,
    visibleListingIds,
    visibleTourDayIds,
    hidden: {
      locales: input.locales.length - visibleLocaleIds.size,
      listings:
        activeListings.filter((listing) => visibleLocaleIds.has(listing.locale_id)).length -
        visibleListingIds.size,
      tourDays:
        tourDaysWithStops.filter((day) => visibleLocaleIds.has(day.locale_id)).length -
        visibleTourDayIds.size,
    },
    activeListingCount: countActiveListingsForCap(
      input.listings,
      visibleLocaleIds,
      plan,
    ),
    localeCount: input.locales.length,
    tourDaysWithStopsCount: countTourDaysWithStopsForCap(
      input.tourDays,
      visibleLocaleIds,
      plan,
    ),
    proximityRefreshRemaining: proximityRefreshRemaining(input.billing, plan),
    routeSearchColumnCount: countRouteSearchColumnsForCap(
      input.routeSearchCriteria ?? [],
      visibleLocaleIds,
    ),
    photosPerListingLimit: PLAN_LIMITS[plan].photosPerListing,
  };
}

export function sliceVisiblePhotoUrls(urls: string[], plan: EntitlementPlan): string[] {
  const limit = PLAN_LIMITS[plan].photosPerListing;
  if (limit === null) return urls;
  return urls.slice(0, limit);
}

/** Persist at most the plan's stored-photo cap; Pro has no cap. */
export function sliceStoredPhotoUrls(urls: string[], plan: EntitlementPlan): string[] {
  const limit = PLAN_LIMITS[plan].photosStoredPerListing;
  if (limit === null) return urls;
  return urls.slice(0, limit);
}

export function storedPhotoLimit(plan: EntitlementPlan): number | null {
  return PLAN_LIMITS[plan].photosStoredPerListing;
}

function deny(message: string): EntitlementDenial {
  return { ok: false, code: ENTITLEMENT_ERROR_CODE, message };
}

export function checkEntitlementGate(
  snapshot: NestEntitlementSnapshot,
  gate: EntitlementGate,
  context?: {
    listingId?: string;
    localeId?: string;
    photoCount?: number;
    targetTourDayStopCount?: number;
  },
): EntitlementAllow | EntitlementDenial {
  const limits = PLAN_LIMITS[snapshot.plan];

  switch (gate) {
    case 'add_listing': {
      if (context?.localeId && !snapshot.visibleLocaleIds.has(context.localeId)) {
        return deny(PLAN_MESSAGES.localeHidden);
      }
      if (snapshot.activeListingCount >= limits.listings) {
        return deny(PLAN_MESSAGES.listingCap(snapshot.plan));
      }
      return { ok: true };
    }
    case 'create_locale': {
      if (snapshot.localeCount >= limits.locales) {
        return deny(PLAN_MESSAGES.localeCap(snapshot.plan));
      }
      return { ok: true };
    }
    case 'add_tour_day_with_stops': {
      const targetStops = context?.targetTourDayStopCount ?? 0;
      if (targetStops > 0) return { ok: true };
      const cap = limits.tourDaysWithStops;
      if (cap !== null && snapshot.tourDaysWithStopsCount >= cap) {
        return deny(PLAN_MESSAGES.tourDayCap(snapshot.plan));
      }
      return { ok: true };
    }
    case 'add_route_search_column': {
      if (context?.localeId && !snapshot.visibleLocaleIds.has(context.localeId)) {
        return deny(PLAN_MESSAGES.localeHidden);
      }
      const cap = limits.routeSearchColumns;
      if (cap !== null && snapshot.routeSearchColumnCount >= cap) {
        return deny(PLAN_MESSAGES.routeSearchColumnCap(snapshot.plan));
      }
      return { ok: true };
    }
    case 'proximity_compute': {
      return { ok: true };
    }
    case 'proximity_refresh': {
      if (snapshot.plan === 'pro') {
        if (snapshot.proximityRefreshRemaining <= 0) {
          return deny(PLAN_MESSAGES.routeSearchRefreshCap);
        }
        return { ok: true };
      }
      return deny(PLAN_MESSAGES.routeSearchRefreshRequiresPass);
    }
    default: {
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
}

/** Preflight batch tour-day creates (auto-plan save, fill date range). */
export function checkAddTourDaysWithStopsBatch(
  snapshot: NestEntitlementSnapshot,
  additionalNewDaysWithStops: number,
): EntitlementAllow | EntitlementDenial {
  if (additionalNewDaysWithStops <= 0) return { ok: true };
  const limits = PLAN_LIMITS[snapshot.plan];
  const cap = limits.tourDaysWithStops;
  if (cap === null) return { ok: true };
  if (snapshot.tourDaysWithStopsCount + additionalNewDaysWithStops > cap) {
    return deny(PLAN_MESSAGES.tourDayCap(snapshot.plan));
  }
  return { ok: true };
}

export type HuntPassActivation = {
  pass_started_at: string;
  pass_expires_at: string;
  proximity_refresh_granted: number;
  proximity_refresh_used: number;
};

/** Apply Hunt Pass purchase or stack renew (Stripe webhook / checkout). */
export function applyHuntPassActivation(
  billing: NestBillingRow,
  now = new Date(),
): HuntPassActivation {
  const isEarlyRenew =
    billing.pass_expires_at !== null && new Date(billing.pass_expires_at) > now;

  if (isEarlyRenew) {
    const expires = new Date(billing.pass_expires_at!);
    expires.setUTCDate(expires.getUTCDate() + HUNT_PASS_DAYS);
    return {
      pass_started_at: billing.pass_started_at ?? now.toISOString(),
      pass_expires_at: expires.toISOString(),
      proximity_refresh_granted:
        billing.proximity_refresh_granted + PROXIMITY_REFRESH_PER_PASS,
      proximity_refresh_used: billing.proximity_refresh_used,
    };
  }

  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + HUNT_PASS_DAYS);
  return {
    pass_started_at: now.toISOString(),
    pass_expires_at: expires.toISOString(),
    proximity_refresh_granted: PROXIMITY_REFRESH_PER_PASS,
    proximity_refresh_used: 0,
  };
}

export function entitlementDenialResponse(denial: EntitlementDenial): Response {
  return new Response(JSON.stringify({ error: denial.message, code: denial.code }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
