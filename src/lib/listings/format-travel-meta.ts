/** Travel time + distance label for compare cells and listing-only places. */
export function formatTravelMeta(
  durationSec: number | null | undefined,
  distanceM: number | null | undefined,
): string {
  const parts: string[] = [];
  if (durationSec != null && Number.isFinite(durationSec)) {
    const minutes = Math.round(durationSec / 60);
    if (minutes < 60) parts.push(`${minutes}m`);
    else {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      parts.push(m ? `${h}h ${m}m` : `${h}h`);
    }
  }
  if (distanceM != null && Number.isFinite(distanceM)) {
    parts.push(`${(distanceM / 1609.34).toFixed(1)} mi`);
  }
  return parts.join(' · ');
}
