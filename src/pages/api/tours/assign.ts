import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
import { applyCalendarAction } from '../../../lib/tours/calendar-action';

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

  const result = await applyCalendarAction(supabase, localeId, {
    type: 'assign',
    listingIds: [listingId],
    tourDate,
    mode: 'merge',
  });

  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  if (!result.tourDayId) {
    return redirect(`/app/locales/${localeId}/tours?day=${tourDate}`);
  }

  return redirect(`/app/locales/${localeId}/tours/${result.tourDayId}`);
};
