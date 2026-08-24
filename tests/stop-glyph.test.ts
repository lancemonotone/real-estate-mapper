import { describe, expect, it } from 'vitest';
import {
  tourEndGlyph,
  tourListingStopGlyph,
  tourStartGlyph,
} from '../src/lib/tours/stop-glyph';

describe('tourListingStopGlyph', () => {
  it('uses S for property start when no custom start', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: false,
        isStart: true,
        sortOrder: 0,
        index: 0,
      }),
    ).toEqual({ glyph: 'S', role: 'start' });
  });

  it('does not use S when custom start is set', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: true,
        isStart: true,
        sortOrder: 0,
        index: 0,
      }),
    ).toEqual({ glyph: '1', role: 'stop' });
  });

  it('uses sortOrder + 1 when present', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: false,
        isStart: false,
        sortOrder: 3,
        index: 0,
      }),
    ).toEqual({ glyph: '4', role: 'stop' });
  });

  it('falls back to 1-based index', () => {
    expect(
      tourListingStopGlyph({
        hasCustomStart: true,
        isStart: false,
        sortOrder: null,
        index: 2,
      }),
    ).toEqual({ glyph: '3', role: 'stop' });
  });

  it('exports S and E for endpoints', () => {
    expect(tourStartGlyph()).toBe('S');
    expect(tourEndGlyph()).toBe('E');
  });
});
