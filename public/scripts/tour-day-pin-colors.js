/** Keep in sync with src/lib/tours/tour-day-pin-colors.ts */
export const TOUR_DAY_PIN_PALETTE = [
  '#f59e0b',
  '#a78bfa',
  '#38bdf8',
  '#fb7185',
  '#4ade80',
  '#f472b6',
  '#fbbf24',
  '#818cf8',
];

export const TOUR_DAY_PIN_INK = '#0b1220';

/**
 * Stable color for a calendar date (`YYYY-MM-DD`).
 * @param {string | null | undefined} tourDate
 */
export function tourDayPinColor(tourDate) {
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
  return TOUR_DAY_PIN_PALETTE[idx];
}

/**
 * @param {Array<string | null | undefined>} tourDates
 */
export function assignTourDayPinColors(tourDates) {
  const unique = [
    ...new Set(
      tourDates
        .map((d) => (typeof d === 'string' ? d.trim() : ''))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ].sort();

  /** @type {Record<string, string>} */
  const colorByDate = {};
  /** @type {Array<{ tourDate: string, color: string }>} */
  const legend = [];
  for (const tourDate of unique) {
    const color = tourDayPinColor(tourDate);
    if (!color) continue;
    colorByDate[tourDate] = color;
    legend.push({ tourDate, color });
  }
  return { colorByDate, legend };
}

/** `YYYY-MM-DD` → short label for legend chips. */
export function formatPinLegendDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return String(isoDate || '');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}
