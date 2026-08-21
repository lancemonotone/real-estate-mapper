import { describe, expect, it } from 'vitest';
import {
  assertSameTourDate,
  defaultTourDateFromAppointment,
} from '../src/lib/listings/day-grouping';

describe('defaultTourDateFromAppointment', () => {
  it('returns null when no appointment', () => {
    expect(defaultTourDateFromAppointment(null, 'America/New_York')).toBeNull();
  });

  it('formats calendar date in workspace timezone', () => {
    const d = new Date('2026-08-21T22:00:00Z');
    expect(defaultTourDateFromAppointment(d, 'America/New_York')).toBe('2026-08-21');
  });
});

describe('assertSameTourDate', () => {
  it('allows empty or single date', () => {
    expect(() => assertSameTourDate([])).not.toThrow();
    expect(() => assertSameTourDate(['2026-08-21'])).not.toThrow();
  });

  it('throws when dates differ', () => {
    expect(() => assertSameTourDate(['2026-08-21', '2026-08-22'])).toThrow(
      /same day/i,
    );
  });
});
