import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { geocodeAddress } from '../../../lib/google/geocode';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const tourDayId = String(form.get('tour_day_id') ?? '');
  if (!tourDayId) return new Response('Missing tour_day_id', { status: 400 });

  const startAddress = String(form.get('start_address') ?? '').trim();
  const endAddress = String(form.get('end_address') ?? '').trim();
  const clearStart = form.get('clear_start') === '1';
  const clearEnd = form.get('clear_end') === '1';

  const patch: Record<string, string | number | null> = {};

  if (clearStart) {
    patch.start_address = null;
    patch.start_lat = null;
    patch.start_lng = null;
  } else if (startAddress) {
    const geo = await geocodeAddress(startAddress);
    if (!geo) return new Response('Could not geocode start address', { status: 422 });
    patch.start_address = startAddress;
    patch.start_lat = geo.lat;
    patch.start_lng = geo.lng;
  }

  if (clearEnd) {
    patch.end_address = null;
    patch.end_lat = null;
    patch.end_lng = null;
  } else if (endAddress) {
    const geo = await geocodeAddress(endAddress);
    if (!geo) return new Response('Could not geocode end address', { status: 422 });
    patch.end_address = endAddress;
    patch.end_lat = geo.lat;
    patch.end_lng = geo.lng;
  }

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('tour_days').update(patch).eq('id', tourDayId);
    if (error) return new Response(error.message, { status: 400 });
  }

  if (patch.start_lat != null || clearStart) {
    await supabase.from('tour_stops').update({ is_start: false }).eq('tour_day_id', tourDayId);
  }

  const { data: tour } = await supabase
    .from('tour_days')
    .select('locale_id')
    .eq('id', tourDayId)
    .single();

  const wantsJson = request.headers.get('Accept')?.includes('application/json');
  if (wantsJson) {
    return Response.json({ ok: true, tourDayId });
  }

  return redirect(`/app/locales/${tour?.locale_id}/tours/${tourDayId}`);
};
