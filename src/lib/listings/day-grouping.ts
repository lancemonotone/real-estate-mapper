export function defaultTourDateFromAppointment(
  appointmentAt: Date | null,
  timeZone: string,
): string | null {
  if (!appointmentAt) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(appointmentAt);
}

export function assertSameTourDate(dates: string[]): void {
  const unique = [...new Set(dates.filter(Boolean))];
  if (unique.length > 1) {
    throw new Error('All stops on a route must be on the same day');
  }
}
