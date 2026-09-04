/** Total/mo per square foot for value ranking. Null when inputs are incomplete. */
export function dollarsPerSqft(
  monthlyTotal: number | null | undefined,
  sqft: number | null | undefined,
): number | null {
  if (monthlyTotal == null || sqft == null) return null;
  if (!Number.isFinite(monthlyTotal) || !Number.isFinite(sqft) || sqft <= 0) return null;
  return monthlyTotal / sqft;
}

/** Cell text for the Value column: monthly total per sq ft, with unit so it is not read as a price. */
export function formatDollarsPerSqft(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
  return `${amount}/sqft`;
}

export function compareByDollarsPerSqftAsc(
  a: { dpsf: number | null },
  b: { dpsf: number | null },
): number {
  if (a.dpsf == null && b.dpsf == null) return 0;
  if (a.dpsf == null) return 1;
  if (b.dpsf == null) return -1;
  return a.dpsf - b.dpsf;
}

export function compareByMoveInAsc(
  a: { moveIn: number | null },
  b: { moveIn: number | null },
): number {
  if (a.moveIn == null && b.moveIn == null) return 0;
  if (a.moveIn == null) return 1;
  if (b.moveIn == null) return -1;
  return a.moveIn - b.moveIn;
}
