import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const listingId = String(form.get('listing_id') ?? '');
  const tourDate = String(form.get('tour_date') ?? '');
  const localeId = String(form.get('locale_id') ?? '');
  if (!listingId || !tourDate || !localeId) {
    return new Response('Missing fields', { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) return new Response('Locale not found', { status: 404 });

  const { data: tourDay, error } = await supabase
    .from('tour_days')
    .upsert(
      { locale_id: localeId, tour_date: tourDate },
      { onConflict: 'locale_id,tour_date' },
    )
    .select('id')
    .single();

  if (error || !tourDay) return new Response(error?.message ?? 'Failed', { status: 400 });

  const { error: stopError } = await supabase.from('tour_stops').upsert(
    { tour_day_id: tourDay.id, listing_id: listingId, is_start: false },
    { onConflict: 'tour_day_id,listing_id' },
  );
  if (stopError) return new Response(stopError.message, { status: 400 });

  return redirect(`/app/locales/${localeId}/tours/${tourDay.id}`);
};
