import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { optimizeTourDay } from '../../../lib/tours/optimize-tour-day';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const tourDayId = String(form.get('tour_day_id') ?? '');
  const listingId = String(form.get('listing_id') ?? '');
  if (!tourDayId || !listingId) return new Response('Missing fields', { status: 400 });

  await supabase.from('tour_stops').update({ is_start: false }).eq('tour_day_id', tourDayId);
  const { error } = await supabase
    .from('tour_stops')
    .update({ is_start: true })
    .eq('tour_day_id', tourDayId)
    .eq('listing_id', listingId);

  if (error) return new Response(error.message, { status: 400 });

  // Property start replaces custom start.
  await supabase
    .from('tour_days')
    .update({
      start_address: null,
      start_lat: null,
      start_lng: null,
      start_name: null,
      start_place_id: null,
    })
    .eq('id', tourDayId);

  const optimized = await optimizeTourDay(supabase, tourDayId, {
    startListingId: listingId,
  });
  if (!optimized.ok) {
    return new Response(optimized.error, { status: optimized.status });
  }

  const { data: tour } = await supabase
    .from('tour_days')
    .select('locale_id')
    .eq('id', tourDayId)
    .single();

  return redirect(`/app/locales/${tour?.locale_id}/tours/${tourDayId}`);
};
