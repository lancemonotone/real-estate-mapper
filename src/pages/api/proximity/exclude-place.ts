import type { APIRoute } from 'astro';
import { excludeLocalePoiAndRecompute } from '../../../lib/proximity/compute-result';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: {
    locale_id?: string;
    place_type_key?: string;
    place_id?: string;
    listing_id?: string;
    criterion_id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const localeId = typeof body.locale_id === 'string' ? body.locale_id.trim() : '';
  const placeTypeKey =
    typeof body.place_type_key === 'string' ? body.place_type_key.trim() : '';
  const placeId = typeof body.place_id === 'string' ? body.place_id.trim() : '';
  const sourceListingId =
    typeof body.listing_id === 'string' ? body.listing_id.trim() : '';
  const sourceCriterionId =
    typeof body.criterion_id === 'string' ? body.criterion_id.trim() : '';

  if (!localeId || !placeTypeKey || !placeId) {
    return new Response(
      JSON.stringify({
        error: 'locale_id, place_type_key, and place_id required',
      }),
      { status: 400 },
    );
  }

  try {
    const { results } = await excludeLocalePoiAndRecompute(supabase, {
      localeId,
      placeTypeKey,
      placeId,
      sourceListingId: sourceListingId || undefined,
      sourceCriterionId: sourceCriterionId || undefined,
    });
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Exclude failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
