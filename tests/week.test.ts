import { describe, expect, it } from 'vitest';
import {
  addDays,
  parseDateKey,
  startOfWeekSunday,
  toDateKey,
  weekDateKeys,
} from '../src/lib/tours/week';

describe('week helpers', () => {
  it('toDateKey formats local YMD', () => {
    expect(toDateKey(new Date(2026, 7, 24))).toBe('2026-08-24');
  });

  it('weekDateKeys returns Sunday–Saturday containing anchor', () => {
    const keys = weekDateKeys(parseDateKey('2026-08-24'));
    expect(keys).toEqual([
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ]);
  });

  it('addDays shifts calendar date', () => {
    expect(toDateKey(addDays(parseDateKey('2026-08-29'), 1))).toBe('2026-08-30');
  });

  it('startOfWeekSunday is Sunday', () => {
    expect(toDateKey(startOfWeekSunday(parseDateKey('2026-08-24')))).toBe('2026-08-23');
  });
});
