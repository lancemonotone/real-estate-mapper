import { describe, expect, it } from 'vitest';
import {
  formatAmenities,
  formatMoney,
  formatNumber,
  formatSqft,
  sumListingMonthlyTotal,
  sumListingMoveInTotal,
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

  it('formats square feet as a locale number', () => {
    expect(formatSqft(850)).toBe('850');
    expect(formatSqft(1200)).toBe('1,200');
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

describe('listing cost totals', () => {
  it('sums monthly costs when components are present', () => {
    expect(
      sumListingMonthlyTotal({
        price_monthly: 1581,
        fees_monthly: 117,
        pet_rent_monthly: 50,
      }),
    ).toBe(1748);
  });

  it('sums move-in costs when components are present', () => {
    expect(
      sumListingMoveInTotal({
        application_fees: 325,
        move_in_fees: 55,
        pet_deposit: 500,
      }),
    ).toBe(880);
  });
});
