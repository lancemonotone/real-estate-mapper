/** Local calendar date as `YYYY-MM-DD` (no UTC shift). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) throw new Error(`Invalid date key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** Sunday-start week containing `d`. */
export function startOfWeekSunday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

/** Seven date keys Sunday–Saturday for the week containing `anchor`. */
export function weekDateKeys(anchor: Date): string[] {
  const start = startOfWeekSunday(anchor);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

/** Inclusive date keys from startKey through endKey (local calendar). */
export function dateKeysInclusive(startKey: string, endKey: string): string[] {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (start.getTime() > end.getTime()) {
    throw new Error('startDate must be on or before endDate');
  }
  const keys: string[] = [];
  let cur = start;
  while (cur.getTime() <= end.getTime()) {
    keys.push(toDateKey(cur));
    cur = addDays(cur, 1);
  }
  return keys;
}
