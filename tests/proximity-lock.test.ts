import { describe, expect, it } from 'vitest';
import {
  isCachedOkProximityResult,
  shouldRefreshLockedRoute,
} from '../src/lib/proximity/compute-result';

describe('shouldRefreshLockedRoute', () => {
  it('true when locked ok with coords', () => {
    expect(
      shouldRefreshLockedRoute({
        locked: true,
        status: 'ok',
        place_lat: 1,
        place_lng: 2,
        place_id: 'x',
        place_name: 'X',
      }),
    ).toBe(true);
  });

  it('false when unlocked', () => {
    expect(
      shouldRefreshLockedRoute({
        locked: false,
        status: 'ok',
        place_lat: 1,
        place_lng: 2,
        place_id: 'x',
        place_name: 'X',
      }),
    ).toBe(false);
  });

  it('false when locked but missing coords', () => {
    expect(
      shouldRefreshLockedRoute({
        locked: true,
        status: 'ok',
        place_lat: null,
        place_lng: null,
        place_id: 'x',
        place_name: 'X',
      }),
    ).toBe(false);
  });
});

describe('isCachedOkProximityResult', () => {
  it('true for ok result with place', () => {
    expect(
      isCachedOkProximityResult({
        status: 'ok',
        place_lat: 1,
        place_lng: 2,
        place_id: 'x',
      }),
    ).toBe(true);
  });

  it('false when missing place id', () => {
    expect(
      isCachedOkProximityResult({
        status: 'ok',
        place_lat: 1,
        place_lng: 2,
        place_id: null,
      }),
    ).toBe(false);
  });

  it('false when not ok', () => {
    expect(
      isCachedOkProximityResult({
        status: 'error',
        place_lat: 1,
        place_lng: 2,
        place_id: 'x',
      }),
    ).toBe(false);
  });
});
