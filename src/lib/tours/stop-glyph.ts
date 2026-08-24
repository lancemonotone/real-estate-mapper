/** Glyph shown on tour map pins and matching list badges. */

export type TourStopGlyphRole = 'start' | 'end' | 'stop';

export function tourStartGlyph(): string {
  return 'S';
}

export function tourEndGlyph(): string {
  return 'E';
}

/**
 * Listing-stop glyph matching tour-map markers.
 * Property start (no custom start) → S; otherwise sort_order+1 or 1-based index.
 */
export function tourListingStopGlyph(opts: {
  hasCustomStart: boolean;
  isStart: boolean;
  sortOrder: number | null;
  index: number;
}): { glyph: string; role: TourStopGlyphRole } {
  const isPropertyStart = !opts.hasCustomStart && opts.isStart;
  if (isPropertyStart) {
    return { glyph: tourStartGlyph(), role: 'start' };
  }
  const glyph =
    opts.sortOrder != null ? String(opts.sortOrder + 1) : String(opts.index + 1);
  return { glyph, role: 'stop' };
}
