/** Glyph shown on tour map pins and matching list badges. */

export type TourStopGlyphRole = 'start' | 'end' | 'stop';

export function tourStartGlyph(): string {
  return 'S';
}

export function tourEndGlyph(): string {
  return 'E';
}

/**
 * Listing-stop glyph for the ordered route.
 * Route ends (custom start/end or first/last listing) use S/E;
 * middle listings are numbered starting at 2 (S counts as the first stop).
 * A sole listing with no custom endpoints is S.
 */
export function tourListingStopGlyph(opts: {
  hasCustomStart: boolean;
  hasCustomEnd: boolean;
  index: number;
  listingCount: number;
}): { glyph: string; role: TourStopGlyphRole } {
  const { hasCustomStart, hasCustomEnd, index, listingCount } = opts;
  if (listingCount <= 0 || index < 0 || index >= listingCount) {
    return { glyph: '•', role: 'stop' };
  }

  const isRouteStart = !hasCustomStart && index === 0;
  const isRouteEnd = !hasCustomEnd && index === listingCount - 1;

  if (isRouteStart && isRouteEnd) {
    return { glyph: tourStartGlyph(), role: 'start' };
  }
  if (isRouteStart) {
    return { glyph: tourStartGlyph(), role: 'start' };
  }
  if (isRouteEnd) {
    return { glyph: tourEndGlyph(), role: 'end' };
  }

  // S is the first stop; numbered middles start at 2.
  const firstMiddleIndex = hasCustomStart ? 0 : 1;
  const number = index - firstMiddleIndex + 2;
  return { glyph: String(number), role: 'stop' };
}
