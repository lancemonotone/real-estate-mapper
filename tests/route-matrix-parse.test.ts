import { describe, expect, it } from 'vitest';
import {
  mapRouteMatrixElements,
  parseDurationSec,
  type RouteMatrixElement,
} from '../src/lib/google/route-matrix';

const FIXTURE: RouteMatrixElement[] = [
  {
    originIndex: 0,
    destinationIndex: 0,
    status: {},
    distanceMeters: 822,
    duration: '160s',
    condition: 'ROUTE_EXISTS',
  },
  {
    originIndex: 0,
    destinationIndex: 1,
    status: {},
    distanceMeters: 2919,
    duration: '361s',
    condition: 'ROUTE_EXISTS',
  },
  {
    originIndex: 0,
    destinationIndex: 2,
    status: { code: 3, message: 'INVALID_ARGUMENT' },
    condition: 'ROUTE_NOT_FOUND',
  },
  {
    originIndex: 0,
    destinationIndex: 3,
    status: {},
    distanceMeters: 100,
    duration: '3.5s',
    condition: 'ROUTE_EXISTS',
  },
];

describe('parseDurationSec', () => {
  it('parses integer second strings', () => {
    expect(parseDurationSec('160s')).toBe(160);
  });

  it('parses fractional second strings', () => {
    expect(parseDurationSec('3.5s')).toBe(3.5);
  });

  it('parses object form with seconds', () => {
    expect(parseDurationSec({ seconds: '42' })).toBe(42);
  });

  it('throws when duration is missing or unparseable', () => {
    expect(() => parseDurationSec(undefined)).toThrow(/duration/i);
    expect(() => parseDurationSec('not-a-duration')).toThrow(/duration/i);
  });
});

describe('mapRouteMatrixElements', () => {
  it('maps fixture rows to MatrixLeg with ok from ROUTE_EXISTS', () => {
    const legs = mapRouteMatrixElements(FIXTURE);
    expect(legs).toEqual([
      { destinationIndex: 0, durationSec: 160, distanceM: 822, ok: true },
      { destinationIndex: 1, durationSec: 361, distanceM: 2919, ok: true },
      { destinationIndex: 2, durationSec: 0, distanceM: 0, ok: false },
      { destinationIndex: 3, durationSec: 3.5, distanceM: 100, ok: true },
    ]);
  });
});
