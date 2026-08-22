import { describe, expect, it } from 'vitest';
import {
  formatAmenities,
  formatMoney,
  formatNumber,
  formatSqft,
} from '../src/lib/listings/format-attributes';

describe('formatMoney', () => {
  it('shows em dash for null', () => {
    expect(formatMoney(null)).toBe('—');
  });

  it('formats USD without inventing zero', () => {
    expect(formatMoney(1200)).toBe('$1,200');
    expect(formatMoney(0)).toBe('$0');
  });
});

describe('formatSqft', () => {
  it('shows em dash for null', () => {
    expect(formatSqft(null)).toBe('—');
  });

  it('formats square feet', () => {
    expect(formatSqft(850)).toBe('850 sq ft');
  });
});

describe('formatNumber', () => {
  it('shows em dash for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('keeps half beds/baths', () => {
    expect(formatNumber(2.5)).toBe('2.5');
    expect(formatNumber(3)).toBe('3');
  });
});

describe('formatAmenities', () => {
  it('shows em dash for null or empty', () => {
    expect(formatAmenities(null)).toBe('—');
    expect(formatAmenities([])).toBe('—');
  });

  it('joins tags', () => {
    expect(formatAmenities(['pool', 'gym'])).toBe('pool, gym');
  });
});
