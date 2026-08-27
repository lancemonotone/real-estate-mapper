export type StopForOrder = {
  listingId: string;
  appointmentTime: string | null;
  sortOrder: number | null;
};

/** Parse `HH:MM` or `HH:MM:SS` to minutes past midnight; null if missing/invalid. */
export function appointmentTimeToMinutes(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function sortOrderKey(sortOrder: number | null): number {
  return sortOrder == null || !Number.isFinite(sortOrder) ? Number.POSITIVE_INFINITY : sortOrder;
}

/**
 * Autoroute visit order: timed stops ascending by clock, then date-only
 * stops preserving prior sort_order. If no times, order by sort_order only.
 */
export function orderStopsForAutoroute(stops: StopForOrder[]): StopForOrder[] {
  const timed: Array<StopForOrder & { minutes: number }> = [];
  const untimed: StopForOrder[] = [];

  for (const stop of stops) {
    const minutes = appointmentTimeToMinutes(stop.appointmentTime);
    if (minutes == null) untimed.push(stop);
    else timed.push({ ...stop, minutes });
  }

  timed.sort((a, b) => {
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    return sortOrderKey(a.sortOrder) - sortOrderKey(b.sortOrder);
  });

  untimed.sort((a, b) => sortOrderKey(a.sortOrder) - sortOrderKey(b.sortOrder));

  return [...timed.map(({ minutes: _m, ...rest }) => rest), ...untimed];
}

export function dayHasAppointmentTimes(stops: StopForOrder[]): boolean {
  return stops.some((s) => appointmentTimeToMinutes(s.appointmentTime) != null);
}

/** Normalize for `<input type="time">` (HH:MM). */
export function toTimeInputValue(raw: string | null | undefined): string {
  const minutes = appointmentTimeToMinutes(raw ?? null);
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** User-facing clock label, e.g. `2:30 PM`; null when unset/invalid. */
export function formatAppointmentTime(raw: string | null | undefined): string | null {
  const minutes = appointmentTimeToMinutes(raw ?? null);
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
