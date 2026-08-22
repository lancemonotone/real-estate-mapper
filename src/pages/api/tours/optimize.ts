import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { buildOptimizePlan } from '../../../lib/google/optimize-request';
import { computeOptimizedRoute } from '../../../lib/google/routes';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as {
    tourDayId?: string;
    scratchListingIds?: string[];
    startListingId?: string;
  };

  let listingIds: string[] = [];
  let startListingId = body.startListingId;
  let tourDayId = body.tourDayId;

  if (tourDayId) {
    const { data: stops, error } = await supabase
      .from('tour_stops')
      .select('listing_id, is_start')
      .eq('tour_day_id', tourDayId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    listingIds = (stops ?? []).map((s) => s.listing_id);
    startListingId = (stops ?? []).find((s) => s.is_start)?.listing_id;
  } else if (body.scratchListingIds?.length) {
    listingIds = body.scratchListingIds;
  } else {
    return Response.json({ error: 'Provide tourDayId or scratchListingIds' }, { status: 400 });
  }

  if (!startListingId) {
    return Response.json({ error: 'Exactly one start listing is required' }, { status: 400 });
  }

  const { data: listings, error: listError } = await supabase
    .from('listings')
    .select('id, lat, lng')
    .in('id', listingIds);

  if (listError) return Response.json({ error: listError.message }, { status: 400 });

  const geocoded = (listings ?? []).filter((l) => l.lat != null && l.lng != null);
  if (geocoded.length < 2) {
    return Response.json(
      { error: 'Optimize requires at least 2 geocoded stops' },
      { status: 400 },
    );
  }

  try {
    const plan = buildOptimizePlan(
      geocoded.map((l) => ({
        id: l.id,
        lat: l.lat!,
        lng: l.lng!,
        isStart: l.id === startListingId,
      })),
    );
    const result = await computeOptimizedRoute(plan);

    if (tourDayId) {
      for (let i = 0; i < result.orderedIds.length; i++) {
        const listingId = result.orderedIds[i]!;
        const leg = result.legs[i];
        await supabase
          .from('tour_stops')
          .update({
            sort_order: i,
            leg_duration_sec: leg?.durationSec ?? null,
            leg_distance_m: leg?.distanceM ?? null,
          })
          .eq('tour_day_id', tourDayId)
          .eq('listing_id', listingId);
      }
      await supabase
        .from('tour_days')
        .update({ encoded_polyline: result.encodedPolyline ?? null })
        .eq('id', tourDayId);
    }

    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Optimize failed';
    return Response.json({ error: message }, { status: 500 });
  }
};
