import { describe, expect, it } from 'vitest';
import {
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

  it('sameRouteSignature ignores order and whitespace', () => {
    expect(sameRouteSignature('a,b', 'b, a')).toBe(true);
    expect(sameRouteSignature('a,b', 'a,c')).toBe(false);
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
