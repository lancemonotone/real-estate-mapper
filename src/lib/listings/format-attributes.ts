const EMPTY = '—';

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSqft(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return `${new Intl.NumberFormat('en-US').format(value)} sq ft`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return String(value);
}

export function formatAmenities(value: string[] | null | undefined): string {
  if (value == null || value.length === 0) return EMPTY;
  return value.join(', ');
}

/** Parse optional money/count form field: blank → null; invalid → null (Fail Fast). */
export function parseOptionalNumber(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Parse optional integer form field: blank → null. */
export function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const n = parseOptionalNumber(raw);
  if (n == null) return null;
  return Math.trunc(n);
}

/** Comma-separated amenities → trimmed non-empty tags, or null. */
export function parseAmenities(raw: FormDataEntryValue | null): string[] | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const tags = s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : null;
}
