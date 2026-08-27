import { describe, expect, it } from 'vitest';
import {
  dayHasAppointmentTimes,
  formatAppointmentTime,
  orderStopsForAutoroute,
  toTimeInputValue,
} from '../src/lib/tours/appointment-order';

describe('orderStopsForAutoroute', () => {
  it('orders all date-only stops by sort_order', () => {
    const ordered = orderStopsForAutoroute([
      { listingId: 'c', appointmentTime: null, sortOrder: 2 },
      { listingId: 'a', appointmentTime: null, sortOrder: 0 },
      { listingId: 'b', appointmentTime: null, sortOrder: 1 },
    ]);
    expect(ordered.map((s) => s.listingId)).toEqual(['a', 'b', 'c']);
  });

  it('puts timed stops first by clock, then date-only by prior sort_order', () => {
    const ordered = orderStopsForAutoroute([
      { listingId: 'late', appointmentTime: '15:00:00', sortOrder: 0 },
      { listingId: 'untimed-b', appointmentTime: null, sortOrder: 2 },
      { listingId: 'early', appointmentTime: '09:30', sortOrder: 1 },
      { listingId: 'untimed-a', appointmentTime: null, sortOrder: 1 },
    ]);
    expect(ordered.map((s) => s.listingId)).toEqual([
      'early',
      'late',
      'untimed-a',
      'untimed-b',
    ]);
  });

  it('breaks equal times with sort_order', () => {
    const ordered = orderStopsForAutoroute([
      { listingId: 'second', appointmentTime: '10:00', sortOrder: 5 },
      { listingId: 'first', appointmentTime: '10:00:00', sortOrder: 1 },
    ]);
    expect(ordered.map((s) => s.listingId)).toEqual(['first', 'second']);
  });
});

describe('dayHasAppointmentTimes', () => {
  it('is false when all null', () => {
    expect(
      dayHasAppointmentTimes([{ listingId: 'a', appointmentTime: null, sortOrder: 0 }]),
    ).toBe(false);
  });

  it('is true when any valid time', () => {
    expect(
      dayHasAppointmentTimes([
        { listingId: 'a', appointmentTime: null, sortOrder: 0 },
        { listingId: 'b', appointmentTime: '11:00', sortOrder: 1 },
      ]),
    ).toBe(true);
  });
});

describe('toTimeInputValue', () => {
  it('formats HH:MM:SS to HH:MM', () => {
    expect(toTimeInputValue('14:05:00')).toBe('14:05');
  });

  it('returns empty for null', () => {
    expect(toTimeInputValue(null)).toBe('');
  });
});

describe('formatAppointmentTime', () => {
  it('formats afternoon time for display', () => {
    expect(formatAppointmentTime('14:05:00')).toBe('2:05 PM');
  });

  it('returns null when unset', () => {
    expect(formatAppointmentTime(null)).toBeNull();
  });
});
