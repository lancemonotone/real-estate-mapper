import type { APIRoute } from 'astro';
import {
  setProximityResultLock,
  upsertLockedProximityResult,
} from '../../../lib/proximity/compute-result';
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
    listing_id?: string;
    criterion_id?: string;
    locked?: boolean;
    place_id?: string;
    place_name?: string;
    place_lat?: number;
    place_lng?: number;
    duration_sec?: number;
    distance_m?: number;
    maps_url?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const listingId = typeof body.listing_id === 'string' ? body.listing_id.trim() : '';
  const criterionId =
    typeof body.criterion_id === 'string' ? body.criterion_id.trim() : '';

  if (!listingId || !criterionId) {
    return new Response(
      JSON.stringify({ error: 'listing_id and criterion_id required' }),
      { status: 400 },
    );
  }
  if (typeof body.locked !== 'boolean') {
    return new Response(JSON.stringify({ error: 'locked boolean required' }), {
      status: 400,
    });
  }

  try {
    if (body.locked === false) {
      const result = await setProximityResultLock(
        supabase,
        listingId,
        criterionId,
        false,
      );
      return new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hasPlace =
      typeof body.place_id === 'string' &&
      body.place_id.trim() &&
      typeof body.place_name === 'string' &&
      body.place_name.trim() &&
      typeof body.place_lat === 'number' &&
      typeof body.place_lng === 'number' &&
      typeof body.duration_sec === 'number' &&
      typeof body.distance_m === 'number' &&
      typeof body.maps_url === 'string';

    if (hasPlace) {
      const result = await upsertLockedProximityResult(supabase, listingId, criterionId, {
        place_id: body.place_id!.trim(),
        place_name: body.place_name!.trim(),
        place_lat: body.place_lat!,
        place_lng: body.place_lng!,
        duration_sec: body.duration_sec!,
        distance_m: body.distance_m!,
        maps_url: body.maps_url!,
      });
      return new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: existing, error } = await supabase
      .from('proximity_results')
      .select('*')
      .eq('listing_id', listingId)
      .eq('criterion_id', criterionId)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    if (
      !existing ||
      existing.status !== 'ok' ||
      existing.place_lat == null ||
      existing.place_lng == null ||
      !existing.place_id ||
      !existing.place_name
    ) {
      return new Response(
        JSON.stringify({
          error: 'Cannot lock without place fields on body or an existing ok result',
        }),
        { status: 400 },
      );
    }

    const result = await setProximityResultLock(
      supabase,
      listingId,
      criterionId,
      true,
    );
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Lock update failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
