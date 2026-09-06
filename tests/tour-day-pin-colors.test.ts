import { describe, expect, it } from 'vitest';
import {
  TOUR_DAY_PIN_PALETTE,
  assignTourDayPinColors,
  tourDayPinColor,
} from '../src/lib/tours/tour-day-pin-colors';

describe('tourDayPinColor', () => {
  it('returns a stable palette color for a date', () => {
    const a = tourDayPinColor('2026-09-11');
    const b = tourDayPinColor('2026-09-11');
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(TOUR_DAY_PIN_PALETTE).toContain(a);
  });

  it('returns null for invalid dates', () => {
    expect(tourDayPinColor(null)).toBeNull();
    expect(tourDayPinColor('nope')).toBeNull();
  });
});

describe('assignTourDayPinColors', () => {
  it('legend order is sorted; colors match tourDayPinColor', () => {
    const { colorByDate, legend } = assignTourDayPinColors([
      null,
      '2026-09-11',
      '2026-09-09',
      '2026-09-11',
    ]);
    expect(legend.map((e) => e.tourDate)).toEqual(['2026-09-09', '2026-09-11']);
    expect(colorByDate['2026-09-09']).toBe(tourDayPinColor('2026-09-09'));
    expect(colorByDate['2026-09-11']).toBe(tourDayPinColor('2026-09-11'));
  });
});
