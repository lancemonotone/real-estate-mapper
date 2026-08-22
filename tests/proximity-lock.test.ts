import { describe, expect, it } from 'vitest';
import { shouldRefreshLockedRoute } from '../src/lib/proximity/compute-result';

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
