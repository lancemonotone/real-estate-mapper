import type { APIRoute } from 'astro';
import { geocodeAddress } from '../../../lib/google/geocode';
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

  const body = (await request.json()) as { place?: string };
  const place = body.place?.trim() ?? '';
  if (!place) {
    return new Response(JSON.stringify({ error: 'Place required' }), { status: 400 });
  }

  try {
    const geo = await geocodeAddress(place);
    if (!geo) {
      return new Response(JSON.stringify({ error: 'Place not found' }), { status: 422 });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        lat: geo.lat,
        lng: geo.lng,
        formattedAddress: geo.formattedAddress,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geocode failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
