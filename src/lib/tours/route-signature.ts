/**
 * Bump when stored leg semantics change so old route_signature values
 * no longer match (forces recalculation without touching appointment times).
 */
export const ROUTE_CACHE_VERSION = 'v3';

/** Stable set signature for tour stop listing ids (order-independent, versioned). */
export function routeSignatureForListingIds(ids: Iterable<string>): string {
  const body = [...ids]
    .map((id) => id.trim())
    .filter(Boolean)
    .sort()
    .join(',');
  if (!body) return '';
  return `${ROUTE_CACHE_VERSION}|${body}`;
}

/** Exact match of canonical signatures (includes {@link ROUTE_CACHE_VERSION}). */
export function sameRouteSignature(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a === b;
}
