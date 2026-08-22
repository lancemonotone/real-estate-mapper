import type { APIRoute } from 'astro';
import { fetchPlaceDetails } from '../../../lib/google/places-details';
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

  let body: { place_id?: string; session_token?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const placeId = typeof body.place_id === 'string' ? body.place_id.trim() : '';
  const sessionToken =
    typeof body.session_token === 'string' ? body.session_token.trim() : undefined;

  if (!placeId) {
    return new Response(JSON.stringify({ error: 'place_id required' }), { status: 400 });
  }

  try {
    const place = await fetchPlaceDetails({
      placeId,
      sessionToken: sessionToken || undefined,
    });
    return new Response(JSON.stringify({ place }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Place details failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
