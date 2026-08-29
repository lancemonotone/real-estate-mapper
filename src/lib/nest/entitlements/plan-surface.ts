import { PLAN_LIMITS, PROXIMITY_REFRESH_PER_PASS, type EntitlementPlan } from './constants';
import { PLAN_MESSAGES } from './messages';
import type { NestEntitlementSnapshot } from './types';

export function isLocaleCapReached(snapshot: NestEntitlementSnapshot): boolean {
  return snapshot.localeCount >= PLAN_LIMITS[snapshot.plan].locales;
}

export function isListingCapReached(snapshot: NestEntitlementSnapshot): boolean {
  return snapshot.activeListingCount >= PLAN_LIMITS[snapshot.plan].listings;
}

export function isRouteSearchColumnCapReached(snapshot: NestEntitlementSnapshot): boolean {
  const cap = PLAN_LIMITS[snapshot.plan].routeSearchColumns;
  return cap !== null && snapshot.routeSearchColumnCount >= cap;
}

export type RouteSearchPlanContext = {
  plan: EntitlementPlan;
  canAddColumn: boolean;
  columnCount: number;
  columnCap: number | null;
  ambientMessage: string | null;
  addColumnBlockedMessage: string;
  canRefresh: boolean;
  refreshRemaining: number;
  refreshGranted: number;
  refreshStatusMessage: string | null;
  refreshAmbientMessage: string | null;
  refreshBlockedMessage: string;
  refreshCapBlockedMessage: string;
};

export function buildRouteSearchPlanContext(
  snapshot: NestEntitlementSnapshot,
): RouteSearchPlanContext {
  const columnCap = PLAN_LIMITS[snapshot.plan].routeSearchColumns;
  const canAddColumn =
    columnCap === null || snapshot.routeSearchColumnCount < columnCap;
  let ambientMessage: string | null = null;
  if (snapshot.plan === 'free') {
    ambientMessage = canAddColumn
      ? PLAN_MESSAGES.routeSearchColumnAmbientAvailable
      : PLAN_MESSAGES.routeSearchColumnAmbientAtCap;
  }

  const refreshGranted =
    snapshot.plan === 'pro'
      ? snapshot.billing.proximity_refresh_granted || PROXIMITY_REFRESH_PER_PASS
      : 0;
  const refreshRemaining = snapshot.proximityRefreshRemaining;
  const canRefresh = snapshot.plan === 'pro' && refreshRemaining > 0;

  let refreshStatusMessage: string | null = null;
  let refreshAmbientMessage: string | null = null;
  if (snapshot.plan === 'free') {
    refreshAmbientMessage = PLAN_MESSAGES.routeSearchRefreshRequiresPass;
  } else if (refreshRemaining > 0) {
    refreshStatusMessage = PLAN_MESSAGES.routeSearchRefreshRemaining(
      refreshRemaining,
      refreshGranted,
    );
  } else {
    refreshStatusMessage = PLAN_MESSAGES.routeSearchRefreshCap;
  }

  return {
    plan: snapshot.plan,
    canAddColumn,
    columnCount: snapshot.routeSearchColumnCount,
    columnCap,
    ambientMessage,
    addColumnBlockedMessage: PLAN_MESSAGES.routeSearchColumnCap(snapshot.plan),
    canRefresh,
    refreshRemaining,
    refreshGranted,
    refreshStatusMessage,
    refreshAmbientMessage,
    refreshBlockedMessage: PLAN_MESSAGES.routeSearchRefreshRequiresPass,
    refreshCapBlockedMessage: PLAN_MESSAGES.routeSearchRefreshCap,
  };
}

export function routeSearchPlanClientConfig(ctx: RouteSearchPlanContext) {
  return {
    plan: ctx.plan,
    canAddColumn: ctx.canAddColumn,
    columnCount: ctx.columnCount,
    columnCap: ctx.columnCap,
    addColumnBlockedMessage: ctx.addColumnBlockedMessage,
    canRefresh: ctx.canRefresh,
    refreshRemaining: ctx.refreshRemaining,
    refreshGranted: ctx.refreshGranted,
    refreshStatusMessage: ctx.refreshStatusMessage,
    refreshAmbientMessage: ctx.refreshAmbientMessage,
    refreshBlockedMessage: ctx.refreshBlockedMessage,
    refreshCapBlockedMessage: ctx.refreshCapBlockedMessage,
  };
}
