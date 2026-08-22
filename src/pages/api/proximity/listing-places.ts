import type { APIRoute } from 'astro';
import type { TravelMode } from '../../../lib/types/database';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

function isTravelMode(mode: string): mode is TravelMode {
  return (
    mode === 'DRIVE' ||
    mode === 'WALK' ||
    mode === 'BICYCLE' ||
    mode === 'TRANSIT'
  );
}

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
    listing_id?: string;
    place_id?: string;
    name?: string;
    lat?: number;
    lng?: number;
    travel_mode?: string;
    label?: string | null;
    duration_sec?: number | null;
    distance_m?: number | null;
    maps_url?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const listingId = typeof body.listing_id === 'string' ? body.listing_id.trim() : '';
  const placeId = typeof body.place_id === 'string' ? body.place_id.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const travelMode = body.travel_mode;

  if (!listingId || !placeId || !name) {
    return new Response(
      JSON.stringify({ error: 'listing_id, place_id, and name required' }),
      { status: 400 },
    );
  }
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return new Response(JSON.stringify({ error: 'lat and lng required' }), {
      status: 400,
    });
  }
  if (!travelMode || !isTravelMode(travelMode)) {
    return new Response(
      JSON.stringify({ error: 'travel_mode must be DRIVE, WALK, BICYCLE, or TRANSIT' }),
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const payload = {
    listing_id: listingId,
    place_id: placeId,
    name,
    lat: body.lat,
    lng: body.lng,
    travel_mode: travelMode,
    label: typeof body.label === 'string' ? body.label.trim() || null : null,
    duration_sec:
      typeof body.duration_sec === 'number' ? Math.round(body.duration_sec) : null,
    distance_m:
      typeof body.distance_m === 'number' ? Math.round(body.distance_m) : null,
    maps_url: typeof body.maps_url === 'string' ? body.maps_url : null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('listing_places')
    .upsert(payload, { onConflict: 'listing_id,place_id,travel_mode' })
    .select('*')
    .single();

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Failed to save listing place' }),
      { status: 500 },
    );
  }

  return new Response(JSON.stringify({ place: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request, cookies, locals, url }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'id query required' }), { status: 400 });
  }

  const { error } = await supabase.from('listing_places').delete().eq('id', id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
