import { describe, expect, it } from 'vitest';
import { tourDayDriveLabel } from '../src/lib/tours/tour-day-drive-total';

describe('tourDayDriveLabel', () => {
  it('returns Needs route when autoroute is required', () => {
    expect(
      tourDayDriveLabel({
        needsAutoroute: true,
        routeFresh: false,
        legDurationSecs: [120, 60],
      }),
    ).toBe('Needs route');
  });

  it('sums fresh legs into rounded minutes', () => {
    expect(
      tourDayDriveLabel({
        needsAutoroute: false,
        routeFresh: true,
        legDurationSecs: [90, 90],
      }),
    ).toBe('~3 min drive');
  });

  it('uses at least 1 minute when sum is positive but under 30s', () => {
    expect(
      tourDayDriveLabel({
        needsAutoroute: false,
        routeFresh: true,
        legDurationSecs: [20],
      }),
    ).toBe('~1 min drive');
  });

  it('returns null when fresh but no positive legs', () => {
    expect(
      tourDayDriveLabel({
        needsAutoroute: false,
        routeFresh: true,
        legDurationSecs: [null, 0],
      }),
    ).toBeNull();
  });

  it('returns null when not fresh and no autoroute needed', () => {
    expect(
      tourDayDriveLabel({
        needsAutoroute: false,
        routeFresh: false,
        legDurationSecs: [120],
      }),
    ).toBeNull();
  });
});
