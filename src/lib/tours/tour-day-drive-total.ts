export type TourDayDriveLabelInput = {
  needsAutoroute: boolean;
  routeFresh: boolean;
  legDurationSecs: Array<number | null | undefined>;
};

/**
 * Label for selected-day drive total.
 * Returns null when there is nothing to show (omit the element).
 */
export function tourDayDriveLabel(input: TourDayDriveLabelInput): string | null {
  if (input.needsAutoroute) return 'Needs route';

  if (!input.routeFresh) return null;

  let sumSec = 0;
  let any = false;
  for (const raw of input.legDurationSecs) {
    if (raw == null || !Number.isFinite(raw) || raw <= 0) continue;
    sumSec += raw;
    any = true;
  }
  if (!any || sumSec <= 0) return null;

  const minutes = Math.max(1, Math.round(sumSec / 60));
  return `~${minutes} min drive`;
}
