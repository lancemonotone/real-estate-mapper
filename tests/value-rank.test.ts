import { describe, expect, it } from 'vitest';
import {
  compareByDollarsPerSqftAsc,
  dollarsPerSqft,
  formatDollarsPerSqft,
} from '../src/lib/listings/value-rank';

describe('dollarsPerSqft', () => {
  it('returns null when monthly or sqft missing', () => {
    expect(dollarsPerSqft(null, 1000)).toBeNull();
    expect(dollarsPerSqft(2000, null)).toBeNull();
    expect(dollarsPerSqft(2000, 0)).toBeNull();
  });

  it('divides monthly total by sqft', () => {
    expect(dollarsPerSqft(2000, 1000)).toBe(2);
  });
});

describe('compareByDollarsPerSqftAsc', () => {
  it('sorts lower $/sqft first and pushes nulls last', () => {
    const rows = [{ dpsf: 3 }, { dpsf: null }, { dpsf: 1.5 }, { dpsf: 2 }];
    rows.sort(compareByDollarsPerSqftAsc);
    expect(rows.map((r) => r.dpsf)).toEqual([1.5, 2, 3, null]);
  });
});

describe('formatDollarsPerSqft', () => {
  it('shows a per-sqft rate, not a bare price', () => {
    expect(formatDollarsPerSqft(2)).toBe('$2.00/sqft');
    expect(formatDollarsPerSqft(null)).toBe('-');
  });
});
