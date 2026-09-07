import { describe, expect, it } from 'vitest';
import {
  ROUTE_CACHE_VERSION,
  routeSignatureForListingIds,
  sameRouteSignature,
} from '../src/lib/tours/route-signature';
import { orderIntermediateIds } from '../src/lib/google/routes';

describe('routeSignatureForListingIds', () => {
  it('is order-independent', () => {
    expect(routeSignatureForListingIds(['b', 'a'])).toBe(
      routeSignatureForListingIds(['a', 'b']),
    );
  });

  it('prefixes the cache version', () => {
    expect(routeSignatureForListingIds(['a', 'b']).startsWith(`${ROUTE_CACHE_VERSION}|`)).toBe(
      true,
    );
  });

  it('sameRouteSignature matches versioned forms and ignores listing order', () => {
    expect(
      sameRouteSignature(
        routeSignatureForListingIds(['a', 'b']),
        routeSignatureForListingIds(['b', 'a']),
      ),
    ).toBe(true);
    expect(
      sameRouteSignature(
        routeSignatureForListingIds(['a', 'b']),
        routeSignatureForListingIds(['a', 'c']),
      ),
    ).toBe(false);
  });

  it('treats legacy unversioned signatures as stale', () => {
    expect(sameRouteSignature('a,b', routeSignatureForListingIds(['a', 'b']))).toBe(false);
  });
});

describe('orderIntermediateIds', () => {
  it('applies a valid optimized index', () => {
    expect(orderIntermediateIds(['a', 'b'], [1, 0])).toEqual(['b', 'a']);
  });

  it('falls back when an index is out of range', () => {
    expect(orderIntermediateIds(['a'], [1])).toEqual(['a']);
  });

  it('falls back when index length mismatches', () => {
    expect(orderIntermediateIds(['a', 'b'], [0])).toEqual(['a', 'b']);
  });

  it('uses input order when optimized index is empty', () => {
    expect(orderIntermediateIds(['a', 'b'], [])).toEqual(['a', 'b']);
    expect(orderIntermediateIds(['a'], undefined)).toEqual(['a']);
  });
});
