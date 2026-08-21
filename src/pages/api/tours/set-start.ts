import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

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
  return redirect(`/app/tours/${tourDayId}`);
};
