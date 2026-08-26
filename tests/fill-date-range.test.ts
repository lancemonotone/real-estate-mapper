import { describe, expect, it } from 'vitest';
import { planFillDateRange } from '../src/lib/tours/fill-date-range';
import { dateKeysInclusive } from '../src/lib/tours/week';
import { milesToMeters } from '../src/lib/geo/locale-radius';

describe('dateKeysInclusive', () => {
  it('returns inclusive keys', () => {
    expect(dateKeysInclusive('2026-09-06', '2026-09-08')).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ]);
  });

  it('throws when start after end', () => {
    expect(() => dateKeysInclusive('2026-09-08', '2026-09-06')).toThrow(/before/i);
  });
});

describe('planFillDateRange', () => {
  const radiusM = milesToMeters(3);

  it('spreads across empty days by count then earlier date', () => {
    const result = planFillDateRange({
      rangeDates: ['2026-09-06', '2026-09-07', '2026-09-08'],
      existingByDate: {},
      unscheduled: [
        { id: 'a', lat: 0, lng: 0 },
        { id: 'b', lat: 0.01, lng: 0 },
        { id: 'c', lat: 0.02, lng: 0 },
      ],
      radiusM,
      maxPerDay: 6,
    });
    // All empty + counts 0 → merge score prefers empty equally → earlier date fills first
    // After first on 06, 06 has 1 others 0 → next to 07, then 08
    expect(result.overflowIds).toEqual([]);
    const byDate = Object.fromEntries(
      result.assignments.map((a) => [a.tourDate, a.listingIds]),
    );
    expect(byDate['2026-09-06']).toEqual(['a']);
    expect(byDate['2026-09-07']).toEqual(['b']);
    expect(byDate['2026-09-08']).toEqual(['c']);
  });

  it('prefers lighter day over packing onto nearest busy day', () => {
    // Day 06 has 2 stops near origin; day 07 empty. New listing near origin should
    // still go to empty day 07 (count 0 < count 2) — spread wins.
    const result = planFillDateRange({
      rangeDates: ['2026-09-06', '2026-09-07'],
      existingByDate: {
        '2026-09-06': [
          { listingId: 'x', lat: 0, lng: 0 },
          { listingId: 'y', lat: 0.001, lng: 0 },
        ],
      },
      unscheduled: [{ id: 'new', lat: 0.0005, lng: 0 }],
      radiusM,
      maxPerDay: 6,
    });
    expect(result.assignments).toEqual([
      { tourDate: '2026-09-07', listingIds: ['new'], merge: false },
    ]);
  });

  it('merges onto proximate day when counts are equal', () => {
    const result = planFillDateRange({
      rangeDates: ['2026-09-06', '2026-09-07'],
      existingByDate: {
        '2026-09-06': [{ listingId: 'near', lat: 0, lng: 0 }],
        '2026-09-07': [{ listingId: 'far', lat: 1, lng: 0 }],
      },
      unscheduled: [{ id: 'new', lat: 0.001, lng: 0 }],
      radiusM,
      maxPerDay: 6,
    });
    expect(result.assignments).toEqual([
      { tourDate: '2026-09-06', listingIds: ['new'], merge: true },
    ]);
  });

  it('overflows when no eligible day under max and proximity', () => {
    const result = planFillDateRange({
      rangeDates: ['2026-09-06'],
      existingByDate: {
        '2026-09-06': [
          { listingId: 'a', lat: 0, lng: 0 },
          { listingId: 'b', lat: 0.001, lng: 0 },
        ],
      },
      unscheduled: [{ id: 'far', lat: 10, lng: 10 }],
      radiusM,
      maxPerDay: 6,
    });
    expect(result.assignments).toEqual([]);
    expect(result.overflowIds).toEqual(['far']);
  });

  it('does not exceed maxPerDay', () => {
    const result = planFillDateRange({
      rangeDates: ['2026-09-06'],
      existingByDate: {
        '2026-09-06': [
          { listingId: '1', lat: 0, lng: 0 },
          { listingId: '2', lat: 0, lng: 0 },
        ],
      },
      unscheduled: [
        { id: 'n1', lat: 0, lng: 0 },
        { id: 'n2', lat: 0, lng: 0 },
      ],
      radiusM,
      maxPerDay: 3,
    });
    expect(result.assignments[0]?.listingIds).toEqual(['n1']);
    expect(result.overflowIds).toEqual(['n2']);
  });
});
