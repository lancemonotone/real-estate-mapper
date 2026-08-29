import type { EntitlementPlan } from './constants';

export type NestBillingRow = {
  pass_started_at: string | null;
  pass_expires_at: string | null;
  proximity_refresh_granted: number;
  proximity_refresh_used: number;
};

export type LocaleRow = {
  id: string;
  created_at: string;
};

export type ListingRow = {
  id: string;
  locale_id: string;
  created_at: string;
  archived_at: string | null;
};

export type TourDayRow = {
  id: string;
  locale_id: string;
  created_at: string;
  stop_count: number;
};

export type NestEntitlementSnapshot = {
  plan: EntitlementPlan;
  billing: NestBillingRow;
  visibleLocaleIds: Set<string>;
  visibleListingIds: Set<string>;
  visibleTourDayIds: Set<string>;
  hidden: {
    locales: number;
    listings: number;
    tourDays: number;
  };
  activeListingCount: number;
  localeCount: number;
  tourDaysWithStopsCount: number;
  proximityRefreshRemaining: number;
  routeSearchColumnCount: number;
  photosPerListingLimit: number;
};

export type EntitlementDenial = {
  ok: false;
  code: typeof import('./constants').ENTITLEMENT_ERROR_CODE;
  message: string;
};

export type EntitlementAllow = { ok: true };
