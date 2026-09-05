import { formatTravelMeta } from '../listings/format-travel-meta';

/**
 * Between-stop drive chip for the Drive overview.
 * Returns null when neither duration nor distance is usable.
 */
export function formatTourLegChip(
  durationSec: number | null | undefined,
  distanceM: number | null | undefined,
): string | null {
  const base = formatTravelMeta(durationSec, distanceM);
  if (!base) return null;
  // formatTravelMeta uses "15m"; Drive overview prefers "~15 min"
  const withMinWord = base.replace(/^(\d+)m\b/, '~$1 min').replace(/^(\d+h(?: \d+m)?)\b/, '~$1');
  if (withMinWord.startsWith('~')) return withMinWord;
  return `~${withMinWord}`;
}

/** Digits for tel: href; null when empty after strip. */
export function listingTelHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits || digits === '+') return null;
  return `tel:${digits}`;
}
