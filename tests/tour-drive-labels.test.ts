import { describe, expect, it } from 'vitest';
import { formatTourLegChip, listingTelHref } from '../src/lib/tours/tour-drive-labels';

describe('tour-drive-labels', () => {
  it('formats leg chips with ~ and min word', () => {
    expect(formatTourLegChip(900, 1609.34)).toBe('~15 min · 1.0 mi');
    expect(formatTourLegChip(null, null)).toBeNull();
  });

  it('builds tel href or omits', () => {
    expect(listingTelHref('(727) 555-0100')).toBe('tel:7275550100');
    expect(listingTelHref('  ')).toBeNull();
    expect(listingTelHref(null)).toBeNull();
  });
});
