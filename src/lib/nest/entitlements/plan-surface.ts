import { PLAN_LIMITS, type EntitlementPlan } from './constants';
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
  refreshBlockedMessage: string;
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
  return {
    plan: snapshot.plan,
    canAddColumn,
    columnCount: snapshot.routeSearchColumnCount,
    columnCap,
    ambientMessage,
    addColumnBlockedMessage: PLAN_MESSAGES.routeSearchColumnCap(snapshot.plan),
    refreshBlockedMessage: PLAN_MESSAGES.routeSearchRefreshRequiresPass,
  };
}

export function routeSearchPlanClientConfig(ctx: RouteSearchPlanContext) {
  return {
    plan: ctx.plan,
    canAddColumn: ctx.canAddColumn,
    columnCount: ctx.columnCount,
    columnCap: ctx.columnCap,
    addColumnBlockedMessage: ctx.addColumnBlockedMessage,
    refreshBlockedMessage: ctx.refreshBlockedMessage,
  };
}
