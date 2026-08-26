import type { SupabaseClient } from '@supabase/supabase-js';
import { appointmentTimeToMinutes, toTimeInputValue } from './appointment-order';
import { applyCalendarAction } from './calendar-action';
import { optimizeTourDay } from './optimize-tour-day';

export type ListingTourAssignment = {
  tourDayId: string;
  tourDate: string;
  appointmentTime: string | null;
};

export type ParsedTourFields = {
  tourDate: string | null;
  appointmentAt: string | null;
  appointmentTime: string | null;
};

export function parseTourDateField(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function localTimeFromAppointmentAt(appointmentAt: string): string {
  const d = new Date(appointmentAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `<input type="date">` — tour day when assigned, else date from appointment_at. */
export function resolveListingTourDateInput(
  assignment: { tourDate: string; appointmentTime?: string | null } | null | undefined,
  appointmentAt: string | null | undefined,
): string {
  if (assignment?.tourDate && /^\d{4}-\d{2}-\d{2}$/.test(assignment.tourDate)) {
    return assignment.tourDate;
  }
  if (appointmentAt) {
    const date = appointmentAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  }
  return '';
}

/** `<input type="time">` — empty when stop has no appointment_time (shows --:--). */
export function resolveListingTourTimeInput(
  assignment: { tourDate: string; appointmentTime?: string | null } | null | undefined,
  appointmentAt: string | null | undefined,
): string {
  if (assignment) {
    return toTimeInputValue(assignment.appointmentTime ?? null);
  }
  if (appointmentAt) return localTimeFromAppointmentAt(appointmentAt);
  return '';
}

export function parseListingTourFields(
  dateRaw: FormDataEntryValue | null,
  timeRaw: FormDataEntryValue | null,
): ParsedTourFields {
  const tourDate = parseTourDateField(dateRaw);
  const timeInput = String(timeRaw ?? '').trim();

  if (!tourDate) {
    return { tourDate: null, appointmentAt: null, appointmentTime: null };
  }

  if (!timeInput) {
    return { tourDate, appointmentAt: null, appointmentTime: null };
  }

  const appointmentTime = normalizeStoredAppointmentTime(timeInput);
  if (!appointmentTime) {
    return { tourDate, appointmentAt: null, appointmentTime: null };
  }

  const hhmm = appointmentTime.slice(0, 5);
  const appointmentAt = new Date(`${tourDate}T${hhmm}`).toISOString();
  return { tourDate, appointmentAt, appointmentTime };
}

function normalizeStoredAppointmentTime(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const minutes = appointmentTimeToMinutes(raw);
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

export async function getListingTourAssignment(
  supabase: SupabaseClient,
  localeId: string,
  listingId: string,
): Promise<ListingTourAssignment | null> {
  const { data: localeTours } = await supabase
    .from('tour_days')
    .select('id, tour_date')
    .eq('locale_id', localeId);

  const tourIds = (localeTours ?? []).map((t) => t.id);
  if (tourIds.length === 0) return null;

  const { data: stop } = await supabase
    .from('tour_stops')
    .select('tour_day_id, appointment_time')
    .eq('listing_id', listingId)
    .in('tour_day_id', tourIds)
    .limit(1)
    .maybeSingle();

  if (!stop) return null;

  const day = (localeTours ?? []).find((t) => t.id === stop.tour_day_id);
  if (!day) return null;

  return {
    tourDayId: day.id,
    tourDate: day.tour_date,
    appointmentTime: (stop.appointment_time as string | null) ?? null,
  };
}

export async function syncListingTour(
  supabase: SupabaseClient,
  localeId: string,
  listingId: string,
  tourDate: string | null,
  appointmentTime: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getListingTourAssignment(supabase, localeId, listingId);
  const storedTime = normalizeStoredAppointmentTime(appointmentTime);

  if (!tourDate) {
    if (!current) return { ok: true };
    const result = await applyCalendarAction(supabase, localeId, {
      type: 'unassign',
      listingIds: [listingId],
      tourDayId: current.tourDayId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  }

  let tourDayId = current?.tourDayId ?? null;

  if (tourDate !== current?.tourDate) {
    const result = await applyCalendarAction(supabase, localeId, {
      type: 'assign',
      listingIds: [listingId],
      tourDate,
      mode: 'merge',
    });
    if (!result.ok) return { ok: false, error: result.error };
    tourDayId = result.tourDayId;
  } else if (!tourDayId) {
    const result = await applyCalendarAction(supabase, localeId, {
      type: 'assign',
      listingIds: [listingId],
      tourDate,
      mode: 'merge',
    });
    if (!result.ok) return { ok: false, error: result.error };
    tourDayId = result.tourDayId;
  }

  if (!tourDayId) {
    return { ok: false, error: 'Tour day not found after assign' };
  }

  const currentStoredTime = normalizeStoredAppointmentTime(current?.appointmentTime ?? null);
  if (storedTime !== currentStoredTime || tourDate !== current?.tourDate) {
    const { error } = await supabase
      .from('tour_stops')
      .update({ appointment_time: storedTime })
      .eq('tour_day_id', tourDayId)
      .eq('listing_id', listingId);
    if (error) return { ok: false, error: error.message };

    await optimizeTourDay(supabase, tourDayId);
  }

  return { ok: true };
}
