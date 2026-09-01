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
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return String(value);
}

export function formatAmenities(value: string[] | null | undefined): string {
  if (value == null || value.length === 0) return EMPTY;
  return value.join(', ');
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let any = false;
  for (const value of values) {
    if (value == null) continue;
    total += value;
    any = true;
  }
  return any ? total : null;
}

/** Base rent + recurring fees + pet rent when present. */
export function sumListingMonthlyTotal(listing: {
  price_monthly?: number | null;
  fees_monthly?: number | null;
  pet_rent_monthly?: number | null;
}): number | null {
  return sumNullable([
    listing.price_monthly,
    listing.fees_monthly,
    listing.pet_rent_monthly,
  ]);
}

/** Application + move-in + security deposit + pet deposit when present. */
export function sumListingMoveInTotal(listing: {
  application_fees?: number | null;
  move_in_fees?: number | null;
  deposit?: number | null;
  pet_deposit?: number | null;
}): number | null {
  return sumNullable([
    listing.application_fees,
    listing.move_in_fees,
    listing.deposit,
    listing.pet_deposit,
  ]);
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
