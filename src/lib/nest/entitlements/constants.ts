export type EntitlementPlan = 'free' | 'pro';

export const HUNT_PASS_DAYS = 90;
export const PROXIMITY_REFRESH_PER_PASS = 60;

export const PLAN_LIMITS = {
  free: {
    locales: 1,
    listings: 12,
    tourDaysWithStops: 3,
    /** Route search columns (Travel Times compare) per Nest on visible Locales. */
    routeSearchColumns: 1,
    /** Photos shown in list/detail UI on Free. */
    photosPerListing: 1,
    /** Photos that may be saved on a listing (not all shown on Free). */
    photosStoredPerListing: 30,
  },
  pro: {
    locales: 5,
    listings: 100,
    tourDaysWithStops: null as number | null,
    routeSearchColumns: null as number | null,
    photosPerListing: 30,
    photosStoredPerListing: 30,
  },
} as const;

export type EntitlementGate =
  | 'add_listing'
  | 'create_locale'
  | 'add_tour_day_with_stops'
  | 'add_route_search_column'
  | 'proximity_compute'
  | 'proximity_refresh'
  | 'add_photo';

export const ENTITLEMENT_ERROR_CODE = 'plan_limit' as const;
