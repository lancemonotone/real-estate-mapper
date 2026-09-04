const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function autoPlanRangeCookieName(localeId: string): string {
  return `wayhome_ap_range_${localeId}`;
}

export function parseAutoPlanRangeCookie(
  raw: string | undefined | null,
): { startDate: string; endDate: string } | null {
  if (!raw) return null;
  const [startDate, endDate] = raw.split('_');
  if (!startDate || !endDate || !DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return null;
  }
  if (startDate > endDate) return null;
  return { startDate, endDate };
}

export function formatAutoPlanRangeCookie(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`;
}
