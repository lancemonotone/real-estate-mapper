/** Stable set signature for tour stop listing ids (order-independent). */
export function routeSignatureForListingIds(ids: Iterable<string>): string {
  return [...ids]
    .map((id) => id.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

export function sameRouteSignature(a: string, b: string): boolean {
  return (
    routeSignatureForListingIds(a.split(',')) ===
    routeSignatureForListingIds(b.split(','))
  );
}
