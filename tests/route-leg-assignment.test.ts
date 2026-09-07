import { describe, expect, it } from 'vitest';
import {
  customEndIncomingLeg,
  incomingLegForPathIndex,
} from '../src/lib/tours/route-leg-assignment';

describe('incomingLegForPathIndex', () => {
  const legs = [
    { durationSec: 960, distanceM: 9656 },
    { durationSec: 180, distanceM: 965 },
    { durationSec: 300, distanceM: 2000 },
  ];

  it('returns null for the origin path index (no incoming leg)', () => {
    expect(incomingLegForPathIndex(legs, 0)).toBeNull();
  });

  it('maps custom-start → first listing to legs[0]', () => {
    // fullPath: [null, listingA, listingB] — listingA at index 1
    expect(incomingLegForPathIndex(legs, 1)).toEqual(legs[0]);
  });

  it('maps each later listing to the prior path leg', () => {
    expect(incomingLegForPathIndex(legs, 2)).toEqual(legs[1]);
    expect(incomingLegForPathIndex(legs, 3)).toEqual(legs[2]);
  });

  it('returns null when the prior leg index is past the array', () => {
    expect(incomingLegForPathIndex(legs, 99)).toBeNull();
  });
});

describe('customEndIncomingLeg', () => {
  const legs = [
    { durationSec: 960, distanceM: 9656 },
    { durationSec: 180, distanceM: 965 },
    { durationSec: 420, distanceM: 3200 },
  ];

  it('returns the final leg when the path ends with a custom end slot', () => {
    expect(customEndIncomingLeg(legs, [null, 'a', 'b', null])).toEqual(legs[2]);
    expect(customEndIncomingLeg(legs, ['a', 'b', null])).toEqual(legs[1]);
  });

  it('returns null when there is no custom end slot', () => {
    expect(customEndIncomingLeg(legs, [null, 'a', 'b'])).toBeNull();
    expect(customEndIncomingLeg(legs, ['a', 'b'])).toBeNull();
  });
});
