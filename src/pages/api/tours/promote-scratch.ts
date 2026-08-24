import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as {
    localeId?: string;
    tourDate?: string;
    listingIdsInOrder?: string[];
    startListingId?: string | null;
    fullPathIds?: Array<string | null>;
    legs?: Array<{ durationSec: number; distanceM: number }>;
    encodedPolyline?: string | null;
    customStart?: { lat: number; lng: number; address?: string | null } | null;
    customEnd?: { lat: number; lng: number; address?: string | null } | null;
  };

  if (!body.localeId || !body.tourDate || !body.listingIdsInOrder?.length) {
    return Response.json(
      { error: 'localeId, tourDate and listingIdsInOrder required' },
      { status: 400 },
    );
  }

  const locale = await getLocaleForNestMember(supabase, body.localeId);
  if (!locale) return Response.json({ error: 'Locale not found' }, { status: 404 });

  const hasCustomStart = Boolean(body.customStart?.lat != null && body.customStart?.lng != null);
  if (!hasCustomStart && !body.startListingId) {
    return Response.json(
      { error: 'startListingId or customStart required' },
      { status: 400 },
    );
  }

  const { data: tourDay, error } = await supabase
    .from('tour_days')
    .upsert(
      {
        locale_id: body.localeId,
        tour_date: body.tourDate,
        encoded_polyline: body.encodedPolyline ?? null,
        route_signature: body.listingIdsInOrder.join(','),
        start_address: hasCustomStart ? body.customStart?.address ?? null : null,
        start_lat: hasCustomStart ? body.customStart!.lat : null,
        start_lng: hasCustomStart ? body.customStart!.lng : null,
        end_address: body.customEnd ? body.customEnd.address ?? null : null,
        end_lat: body.customEnd?.lat ?? null,
        end_lng: body.customEnd?.lng ?? null,
      },
      { onConflict: 'locale_id,tour_date' },
    )
    .select('id')
    .single();

  if (error || !tourDay) {
    return Response.json({ error: error?.message ?? 'Could not create tour day' }, { status: 400 });
  }

  await supabase.from('tour_stops').delete().eq('tour_day_id', tourDay.id);

  const fullPathIds = body.fullPathIds ?? body.listingIdsInOrder;
  const rows = body.listingIdsInOrder.map((listingId, i) => {
    const fullIdx = fullPathIds.indexOf(listingId);
    const leg = fullIdx >= 0 ? body.legs?.[fullIdx] : body.legs?.[i];
    return {
      tour_day_id: tourDay.id,
      listing_id: listingId,
      is_start: !hasCustomStart && listingId === body.startListingId,
      sort_order: i,
      leg_duration_sec: leg?.durationSec ?? null,
      leg_distance_m: leg?.distanceM ?? null,
    };
  });

  const { error: stopError } = await supabase.from('tour_stops').insert(rows);
  if (stopError) return Response.json({ error: stopError.message }, { status: 400 });

  return Response.json({ ok: true, tourDayId: tourDay.id });
};
