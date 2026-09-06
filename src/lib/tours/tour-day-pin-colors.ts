/** Stable tour-date colors shared by locale-map pins, week dots, and tour-map stops. */
export const TOUR_DAY_PIN_PALETTE = [
  '#f59e0b',
  '#a78bfa',
  '#38bdf8',
  '#fb7185',
  '#4ade80',
  '#f472b6',
  '#fbbf24',
  '#818cf8',
] as const;

/** Dark ink on bright palette fills (glyphs / stop counts). */
export const TOUR_DAY_PIN_INK = '#0b1220';

export type TourDayPinLegendEntry = {
  tourDate: string;
  color: string;
};

export type TourDayPinColorAssignment = {
  colorByDate: Record<string, string>;
  legend: TourDayPinLegendEntry[];
};

/**
 * Stable color for a calendar date (`YYYY-MM-DD`).
 * Same date → same color everywhere in the app.
 */
export function tourDayPinColor(tourDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tourDate ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const len = TOUR_DAY_PIN_PALETTE.length;
  const idx = ((dayIndex % len) + len) % len;
  return TOUR_DAY_PIN_PALETTE[idx]!;
}

/**
 * Legend for dates present on a surface (sorted ascending).
 * Colors come from {@link tourDayPinColor} (stable per date).
 */
export function assignTourDayPinColors(
  tourDates: Array<string | null | undefined>,
): TourDayPinColorAssignment {
  const unique = [
    ...new Set(
      tourDates
        .map((d) => (typeof d === 'string' ? d.trim() : ''))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ].sort();

  const colorByDate: Record<string, string> = {};
  const legend: TourDayPinLegendEntry[] = [];
  for (const tourDate of unique) {
    const color = tourDayPinColor(tourDate);
    if (!color) continue;
    colorByDate[tourDate] = color;
    legend.push({ tourDate, color });
  }
  return { colorByDate, legend };
}
