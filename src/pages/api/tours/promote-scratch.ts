import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { ensureWorkspaceForUser, getPrimaryWorkspaceId } from '../../../lib/supabase/workspace';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let workspaceId = await getPrimaryWorkspaceId(supabase, user.id);
  if (!workspaceId) workspaceId = await ensureWorkspaceForUser(supabase, user.id);

  const body = (await request.json()) as {
    tourDate?: string;
    listingIdsInOrder?: string[];
    startListingId?: string;
    legs?: Array<{ durationSec: number; distanceM: number }>;
    encodedPolyline?: string | null;
  };

  if (!body.tourDate || !body.listingIdsInOrder?.length || !body.startListingId) {
    return Response.json({ error: 'tourDate, listingIdsInOrder, startListingId required' }, { status: 400 });
  }

  const { data: tourDay, error } = await supabase
    .from('tour_days')
    .upsert(
      {
        workspace_id: workspaceId,
        tour_date: body.tourDate,
        encoded_polyline: body.encodedPolyline ?? null,
      },
      { onConflict: 'workspace_id,tour_date' },
    )
    .select('id')
    .single();

  if (error || !tourDay) {
    return Response.json({ error: error?.message ?? 'Could not create tour day' }, { status: 400 });
  }

  await supabase.from('tour_stops').delete().eq('tour_day_id', tourDay.id);

  const rows = body.listingIdsInOrder.map((listingId, i) => ({
    tour_day_id: tourDay.id,
    listing_id: listingId,
    is_start: listingId === body.startListingId,
    sort_order: i,
    leg_duration_sec: body.legs?.[i]?.durationSec ?? null,
    leg_distance_m: body.legs?.[i]?.distanceM ?? null,
  }));

  const { error: stopError } = await supabase.from('tour_stops').insert(rows);
  if (stopError) return Response.json({ error: stopError.message }, { status: 400 });

  return Response.json({ ok: true, tourDayId: tourDay.id });
};
