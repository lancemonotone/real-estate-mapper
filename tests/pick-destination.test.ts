import { describe, expect, it } from 'vitest';
import { pickDestinationListingId } from '../src/lib/geo/pick-destination';

describe('pickDestinationListingId', () => {
  it('picks farthest geodesic from start; ties break by lowest id', () => {
    const start = { id: 's', lat: 0, lng: 0 };
    const near = { id: 'b', lat: 0.01, lng: 0 };
    const far = { id: 'a', lat: 1, lng: 0 };
    const alsoFar = { id: 'c', lat: 1, lng: 0 };
    expect(
      pickDestinationListingId(start.id, [start, near, far, alsoFar]),
    ).toBe('a');
  });

  it('throws when fewer than 2 geocoded stops', () => {
    expect(() =>
      pickDestinationListingId('s', [{ id: 's', lat: 0, lng: 0 }]),
    ).toThrow(/at least 2/i);
  });
});
