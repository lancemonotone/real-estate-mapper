import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
import { optimizeTourDay } from '../../../lib/tours/optimize-tour-day';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const listingId = String(form.get('listing_id') ?? '');
  const tourDayId = String(form.get('tour_day_id') ?? '');
  const localeId = String(form.get('locale_id') ?? '');
  const returnTo = String(form.get('return_to') ?? '');
  if (!listingId || !tourDayId || !localeId) {
    return new Response('Missing fields', { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) return new Response('Locale not found', { status: 404 });

  const { data: tourDay } = await supabase
    .from('tour_days')
    .select('id, locale_id, tour_date')
    .eq('id', tourDayId)
    .maybeSingle();
  if (!tourDay || tourDay.locale_id !== localeId) {
    return new Response('Tour day not found', { status: 404 });
  }

  const { error: stopError } = await supabase
    .from('tour_stops')
    .delete()
    .eq('tour_day_id', tourDayId)
    .eq('listing_id', listingId);
  if (stopError) return new Response(stopError.message, { status: 400 });

  const { count, error: countError } = await supabase
    .from('tour_stops')
    .select('listing_id', { count: 'exact', head: true })
    .eq('tour_day_id', tourDayId);
  if (countError) return new Response(countError.message, { status: 400 });

  const dayEmpty = (count ?? 0) === 0;
  if (dayEmpty) {
    const { error: dayError } = await supabase.from('tour_days').delete().eq('id', tourDayId);
    if (dayError) return new Response(dayError.message, { status: 400 });
  } else {
    await supabase
      .from('tour_days')
      .update({ encoded_polyline: null, route_signature: null })
      .eq('id', tourDayId);
    await optimizeTourDay(supabase, tourDayId);
  }

  if (returnTo.startsWith('/app/')) {
    return redirect(returnTo);
  }
  if (dayEmpty) {
    return redirect(`/app/locales/${localeId}/tours`);
  }
  if (tourDay.tour_date) {
    return redirect(`/app/locales/${localeId}/tours?day=${tourDay.tour_date}`);
  }
  return redirect(`/app/locales/${localeId}/tours/${tourDayId}`);
};
