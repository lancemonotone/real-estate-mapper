import type { APIRoute } from 'astro';
import { autocompletePlaces } from '../../../lib/google/places-autocomplete';
import { searchTextPlaces } from '../../../lib/google/places-text';
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
    input?: string;
    locale_id?: string;
    session_token?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const input = typeof body.input === 'string' ? body.input.trim() : '';
  const localeId = typeof body.locale_id === 'string' ? body.locale_id.trim() : '';
  const sessionToken =
    typeof body.session_token === 'string' ? body.session_token.trim() : '';

  if (!input) {
    return new Response(JSON.stringify({ error: 'input required' }), { status: 400 });
  }
  if (!localeId) {
    return new Response(JSON.stringify({ error: 'locale_id required' }), { status: 400 });
  }
  if (!sessionToken) {
    return new Response(
      JSON.stringify({ error: 'session_token required' }),
      { status: 400 },
    );
  }

  const { data: locale, error: localeError } = await supabase
    .from('locales')
    .select('center_lat, center_lng, radius_m')
    .eq('id', localeId)
    .single();

  if (localeError || !locale) {
    return new Response(
      JSON.stringify({ error: localeError?.message ?? 'Locale not found' }),
      { status: 404 },
    );
  }

  try {
    // Text Search first: free-form phrases ("pizza near…", business names) land here.
    // Autocomplete almost always returns prefix noise, so it must not block Text Search.
    const places = await searchTextPlaces({
      lat: locale.center_lat,
      lng: locale.center_lng,
      radiusM: locale.radius_m,
      textQuery: input,
      maxResultCount: 8,
    });
    let suggestions = places.map((p) => ({
      placeId: p.placeId,
      primaryText: p.name,
      secondaryText: p.formattedAddress ?? '',
      lat: p.lat,
      lng: p.lng,
    }));
    let source: 'autocomplete' | 'text' = 'text';

    if (suggestions.length === 0) {
      suggestions = await autocompletePlaces({
        text: input,
        lat: locale.center_lat,
        lng: locale.center_lng,
        radiusM: locale.radius_m,
        sessionToken,
      });
      source = 'autocomplete';
    }

    return new Response(JSON.stringify({ suggestions, source }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Place search failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
