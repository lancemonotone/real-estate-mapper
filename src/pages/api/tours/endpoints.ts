import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { geocodeAddress } from '../../../lib/google/geocode';
import { ensureAllTourDayEndpointsFromLocaleDefaults } from '../../../lib/tours/ensure-tour-endpoints';
import { localeDefaultsPatchFromDayEndpoints } from '../../../lib/tours/locale-default-endpoints';

function optionalTrim(form: FormData, key: string): string | null {
  const v = String(form.get(key) ?? '').trim();
  return v || null;
}

function optionalNumber(form: FormData, key: string): number {
  const raw = String(form.get(key) ?? '').trim();
  if (raw === '') return NaN;
  return Number(raw);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const tourDayId = String(form.get('tour_day_id') ?? '');
  if (!tourDayId) {
    return Response.json({ error: 'Missing tour_day_id' }, { status: 400 });
  }

  const startAddress = String(form.get('start_address') ?? '').trim();
  const endAddress = String(form.get('end_address') ?? '').trim();
  const clearStart = form.get('clear_start') === '1';
  const clearEnd = form.get('clear_end') === '1';
  const persistAsLocaleDefault = form.get('persist_as_locale_default') === '1';
  const startLat = optionalNumber(form, 'start_lat');
  const startLng = optionalNumber(form, 'start_lng');
  const endLat = optionalNumber(form, 'end_lat');
  const endLng = optionalNumber(form, 'end_lng');
  const startName = optionalTrim(form, 'start_name');
  const endName = optionalTrim(form, 'end_name');
  const startPlaceId = optionalTrim(form, 'start_place_id');
  const endPlaceId = optionalTrim(form, 'end_place_id');

  const patch: Record<string, string | number | null> = {};
  let touchedStart = false;
  let touchedEnd = false;

  if (clearStart) {
    patch.start_address = null;
    patch.start_lat = null;
    patch.start_lng = null;
    patch.start_name = null;
    patch.start_place_id = null;
    touchedStart = true;
  } else if (startAddress) {
    if (Number.isFinite(startLat) && Number.isFinite(startLng)) {
      patch.start_address = startAddress;
      patch.start_lat = startLat;
      patch.start_lng = startLng;
      patch.start_name = startName;
      patch.start_place_id = startPlaceId;
    } else {
      const geo = await geocodeAddress(startAddress);
      if (!geo) {
        return Response.json({ error: 'Could not geocode start address' }, { status: 422 });
      }
      patch.start_address = startAddress;
      patch.start_lat = geo.lat;
      patch.start_lng = geo.lng;
      patch.start_name = null;
      patch.start_place_id = null;
    }
    touchedStart = true;
  }

  if (clearEnd) {
    patch.end_address = null;
    patch.end_lat = null;
    patch.end_lng = null;
    patch.end_name = null;
    patch.end_place_id = null;
    touchedEnd = true;
  } else if (endAddress) {
    if (Number.isFinite(endLat) && Number.isFinite(endLng)) {
      patch.end_address = endAddress;
      patch.end_lat = endLat;
      patch.end_lng = endLng;
      patch.end_name = endName;
      patch.end_place_id = endPlaceId;
    } else {
      const geo = await geocodeAddress(endAddress);
      if (!geo) {
        return Response.json({ error: 'Could not geocode end address' }, { status: 422 });
      }
      patch.end_address = endAddress;
      patch.end_lat = geo.lat;
      patch.end_lng = geo.lng;
      patch.end_name = null;
      patch.end_place_id = null;
    }
    touchedEnd = true;
  }

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('tour_days').update(patch).eq('id', tourDayId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (patch.start_lat != null || clearStart) {
    await supabase.from('tour_stops').update({ is_start: false }).eq('tour_day_id', tourDayId);
  }

  const { data: tour } = await supabase
    .from('tour_days')
    .select('locale_id, tour_date')
    .eq('id', tourDayId)
    .single();

  if (persistAsLocaleDefault && tour?.locale_id && (touchedStart || touchedEnd) && !clearStart && !clearEnd) {
    const localePatch = localeDefaultsPatchFromDayEndpoints(patch, {
      start: touchedStart,
      end: touchedEnd,
    });
    if (Object.keys(localePatch).length) {
      const { error: localeError } = await supabase
        .from('locales')
        .update(localePatch)
        .eq('id', tour.locale_id);
      if (localeError) return Response.json({ error: localeError.message }, { status: 400 });
      await ensureAllTourDayEndpointsFromLocaleDefaults(supabase, tour.locale_id);
    }
  }

  const wantsJson = request.headers.get('Accept')?.includes('application/json');
  if (wantsJson) {
    return Response.json({ ok: true, tourDayId });
  }

  if (tour?.tour_date) {
    return redirect(`/app/locales/${tour.locale_id}/tours?day=${tour.tour_date}`);
  }
  return redirect(`/app/locales/${tour?.locale_id}/tours`);
};
