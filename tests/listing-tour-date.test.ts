import { describe, expect, it } from 'vitest';
import {
  parseListingTourFields,
  resolveListingTourDateInput,
  resolveListingTourTimeInput,
} from '../src/lib/tours/listing-tour-date';

describe('resolveListingTourDateInput', () => {
  it('uses tour assignment date', () => {
    expect(resolveListingTourDateInput({ tourDate: '2026-09-11', appointmentTime: null }, null)).toBe(
      '2026-09-11',
    );
  });

  it('falls back to appointment_at date when not on tour', () => {
    expect(resolveListingTourDateInput(null, '2026-08-21T15:00:00.000Z')).toBe('2026-08-21');
  });
});

describe('resolveListingTourTimeInput', () => {
  it('shows stop time when set', () => {
    expect(
      resolveListingTourTimeInput({ tourDate: '2026-09-11', appointmentTime: '14:30:00' }, null),
    ).toBe('14:30');
  });

  it('is empty when stop has no time (date-only tour)', () => {
    expect(
      resolveListingTourTimeInput({ tourDate: '2026-09-11', appointmentTime: null }, null),
    ).toBe('');
  });

  it('uses appointment_at time when not on tour', () => {
    const time = resolveListingTourTimeInput(null, '2026-08-21T15:00:00.000Z');
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('parseListingTourFields', () => {
  it('date only → tour date set, time and appointment_at null', () => {
    expect(parseListingTourFields('2026-09-11', '')).toEqual({
      tourDate: '2026-09-11',
      appointmentAt: null,
      appointmentTime: null,
    });
  });

  it('date + time → all fields set', () => {
    const parsed = parseListingTourFields('2026-09-11', '14:30');
    expect(parsed.tourDate).toBe('2026-09-11');
    expect(parsed.appointmentTime).toBe('14:30:00');
    expect(parsed.appointmentAt).toBe(new Date('2026-09-11T14:30').toISOString());
  });

  it('blank date → all null', () => {
    expect(parseListingTourFields('', '14:30')).toEqual({
      tourDate: null,
      appointmentAt: null,
      appointmentTime: null,
    });
  });
});
