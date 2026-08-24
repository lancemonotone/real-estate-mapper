import { describe, expect, it } from 'vitest';
import {
  tourEndGlyph,
  tourListingStopGlyph,
  tourStartGlyph,
} from '../src/lib/tours/stop-glyph';

describe('tourListingStopGlyph', () => {
  it('uses S for sole listing with no custom endpoints', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: false,
        hasCustomEnd: false,
        index: 0,
        listingCount: 1,
      }),
    ).toEqual({ glyph: 'S', role: 'start' });
  });

  it('uses S then E for two listings with no custom endpoints', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: false,
        hasCustomEnd: false,
        index: 0,
        listingCount: 2,
      }),
    ).toEqual({ glyph: 'S', role: 'start' });
    expect(
      tourListingStopGlyph({
        hasCustomStart: false,
        hasCustomEnd: false,
        index: 1,
        listingCount: 2,
      }),
    ).toEqual({ glyph: 'E', role: 'end' });
  });

  it('numbers middles when first/last are S/E', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: false,
        hasCustomEnd: false,
        index: 1,
        listingCount: 3,
      }),
    ).toEqual({ glyph: '1', role: 'stop' });
  });

  it('uses E on last listing when custom start only', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: true,
        hasCustomEnd: false,
        index: 0,
        listingCount: 2,
      }),
    ).toEqual({ glyph: '1', role: 'stop' });
    expect(
      tourListingStopGlyph({
        hasCustomStart: true,
        hasCustomEnd: false,
        index: 1,
        listingCount: 2,
      }),
    ).toEqual({ glyph: 'E', role: 'end' });
  });

  it('numbers all listings when both custom endpoints exist', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: true,
        hasCustomEnd: true,
        index: 0,
        listingCount: 2,
      }),
    ).toEqual({ glyph: '1', role: 'stop' });
    expect(
      tourListingStopGlyph({
        hasCustomStart: true,
        hasCustomEnd: true,
        index: 1,
        listingCount: 2,
      }),
    ).toEqual({ glyph: '2', role: 'stop' });
  });

  it('exports S and E for endpoints', () => {
    expect(tourStartGlyph()).toBe('S');
    expect(tourEndGlyph()).toBe('E');
  });
});
