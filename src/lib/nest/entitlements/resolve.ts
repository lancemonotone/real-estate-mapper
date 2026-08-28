import {
  ENTITLEMENT_ERROR_CODE,
  HUNT_PASS_DAYS,
  PLAN_LIMITS,
  PROXIMITY_REFRESH_PER_PASS,
  type EntitlementGate,
  type EntitlementPlan,
} from './constants';
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

export function proximityDemoAvailable(billing: NestBillingRow, plan: EntitlementPlan): boolean {
  if (plan === 'pro') return true;
  return billing.proximity_demo_used_at === null;
}

export function sliceVisiblePhotoUrls(urls: string[], plan: EntitlementPlan): string[] {
  const limit = PLAN_LIMITS[plan].photosPerListing;
  return urls.slice(0, limit);
}

export function resolveNestEntitlements(input: {
  billing: NestBillingRow;
  locales: LocaleRow[];
  listings: ListingRow[];
  tourDays: TourDayRow[];
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
    proximityDemoAvailable: proximityDemoAvailable(input.billing, plan),
    photosPerListingLimit: PLAN_LIMITS[plan].photosPerListing,
  };
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
        return deny('This Locale is hidden on the Free plan. Renew Hunt Pass to access it.');
      }
      if (snapshot.activeListingCount >= limits.listings) {
        return deny(
          snapshot.plan === 'free'
            ? 'Free plan allows up to 12 listings. Upgrade to Hunt Pass to add more.'
            : 'Listing limit reached for this Nest. Delete listings or contact support.',
        );
      }
      return { ok: true };
    }
    case 'create_locale': {
      if (snapshot.localeCount >= limits.locales) {
        return deny(
          snapshot.plan === 'free'
            ? 'Free plan allows 1 Locale. Upgrade to Hunt Pass for more.'
            : 'Locale limit reached for this Nest.',
        );
      }
      return { ok: true };
    }
    case 'add_tour_day_with_stops': {
      const targetStops = context?.targetTourDayStopCount ?? 0;
      if (targetStops > 0) return { ok: true };
      const cap = limits.tourDaysWithStops;
      if (cap !== null && snapshot.tourDaysWithStopsCount >= cap) {
        return deny(
          snapshot.plan === 'free'
            ? 'Free plan allows up to 3 tour days. Upgrade to Hunt Pass for more.'
            : 'Tour day limit reached for this Nest.',
        );
      }
      return { ok: true };
    }
    case 'proximity_compute': {
      if (snapshot.plan === 'pro') return { ok: true };
      if (snapshot.proximityDemoAvailable) return { ok: true };
      return deny(
        'Free plan includes one proximity demo. Upgrade to Hunt Pass for full proximity compare.',
      );
    }
    case 'proximity_refresh': {
      if (snapshot.plan === 'pro') {
        if (snapshot.proximityRefreshRemaining <= 0) {
          return deny('Proximity refresh limit reached for this Hunt Pass. Contact support.');
        }
        return { ok: true };
      }
      if (snapshot.proximityDemoAvailable) return { ok: true };
      return deny(
        'Free plan includes one proximity demo. Upgrade to Hunt Pass for proximity refreshes.',
      );
    }
    case 'add_photo': {
      const count = context?.photoCount ?? 0;
      const storedCap =
        'photosStoredPerListing' in limits
          ? limits.photosStoredPerListing
          : limits.photosPerListing;
      if (count <= storedCap) return { ok: true };
      return deny(
        snapshot.plan === 'free'
          ? `Free plan saves up to ${storedCap} photos per listing. Upgrade to Hunt Pass for the full gallery.`
          : 'Photo limit reached for this listing.',
      );
    }
    default: {
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
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
