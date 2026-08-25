import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { buildOptimizePlan } from '../../../lib/google/optimize-request';
import { computeOptimizedRoute } from '../../../lib/google/routes';
import { geocodeAddress } from '../../../lib/google/geocode';
import { routeSignatureForListingIds } from '../../../lib/tours/route-signature';

type LatLng = { lat: number; lng: number };

function readEndpoint(
  body: Record<string, unknown>,
  prefix: 'customStart' | 'customEnd',
): LatLng | null {
  const raw = body[prefix];
  if (!raw || typeof raw !== 'object') return null;
  const { lat, lng } = raw as { lat?: unknown; lng?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const tourDayId = typeof body.tourDayId === 'string' ? body.tourDayId : undefined;
  const scratchListingIds = Array.isArray(body.scratchListingIds)
    ? (body.scratchListingIds as string[])
    : undefined;
  const startListingId =
    typeof body.startListingId === 'string' && body.startListingId
      ? body.startListingId
      : undefined;

  let customStart = readEndpoint(body, 'customStart');
  let customEnd = readEndpoint(body, 'customEnd');
  let customStartAddress =
    typeof body.customStartAddress === 'string' ? body.customStartAddress.trim() : '';
  let customEndAddress =
    typeof body.customEndAddress === 'string' ? body.customEndAddress.trim() : '';

  let listingIds: string[] = [];
  let resolvedStartListingId = startListingId;

  if (tourDayId) {
    const { data: tour, error: tourError } = await supabase
      .from('tour_days')
      .select('start_lat, start_lng, end_lat, end_lng, start_address, end_address')
      .eq('id', tourDayId)
      .single();
    if (tourError) return Response.json({ error: tourError.message }, { status: 400 });

    if (!customStart && tour?.start_lat != null && tour?.start_lng != null) {
      customStart = { lat: tour.start_lat, lng: tour.start_lng };
      customStartAddress = tour.start_address ?? customStartAddress;
    }
    if (!customEnd && tour?.end_lat != null && tour?.end_lng != null) {
      customEnd = { lat: tour.end_lat, lng: tour.end_lng };
      customEndAddress = tour.end_address ?? customEndAddress;
    }

    const { data: stops, error } = await supabase
      .from('tour_stops')
      .select('listing_id, is_start')
      .eq('tour_day_id', tourDayId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    listingIds = (stops ?? []).map((s) => s.listing_id);
    if (!resolvedStartListingId) {
      resolvedStartListingId = (stops ?? []).find((s) => s.is_start)?.listing_id;
    }
  } else if (scratchListingIds?.length) {
    listingIds = scratchListingIds;
  } else {
    return Response.json({ error: 'Provide tourDayId or scratchListingIds' }, { status: 400 });
  }

  try {
    if (!customStart && customStartAddress) {
      const geo = await geocodeAddress(customStartAddress);
      if (!geo) {
        return Response.json({ error: 'Could not geocode custom start address' }, { status: 422 });
      }
      customStart = geo;
    }
    if (!customEnd && customEndAddress) {
      const geo = await geocodeAddress(customEndAddress);
      if (!geo) {
        return Response.json({ error: 'Could not geocode custom end address' }, { status: 422 });
      }
      customEnd = geo;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geocode failed';
    return Response.json({ error: message }, { status: 500 });
  }

  if (!customStart && !resolvedStartListingId) {
    return Response.json(
      { error: 'Set a start listing or a custom start address' },
      { status: 400 },
    );
  }

  const { data: listings, error: listError } = await supabase
    .from('listings')
    .select('id, lat, lng')
    .in('id', listingIds);

  if (listError) return Response.json({ error: listError.message }, { status: 400 });

  const geocoded = (listings ?? []).filter((l) => l.lat != null && l.lng != null);
  if (geocoded.length < 1) {
    return Response.json(
      { error: 'Optimize requires at least 1 geocoded listing' },
      { status: 400 },
    );
  }

  try {
    const plan = buildOptimizePlan(
      geocoded.map((l) => ({
        id: l.id,
        lat: l.lat!,
        lng: l.lng!,
        isStart: !customStart && l.id === resolvedStartListingId,
      })),
      { customStart, customEnd },
    );
    const result = await computeOptimizedRoute(plan);

    if (tourDayId) {
      for (let fullIdx = 0; fullIdx < result.fullPathIds.length; fullIdx++) {
        const listingId = result.fullPathIds[fullIdx];
        if (!listingId) continue;
        const leg = result.legs[fullIdx];
        await supabase
          .from('tour_stops')
          .update({
            sort_order: result.orderedIds.indexOf(listingId),
            is_start: !customStart && listingId === plan.originId,
            leg_duration_sec: leg?.durationSec ?? null,
            leg_distance_m: leg?.distanceM ?? null,
          })
          .eq('tour_day_id', tourDayId)
          .eq('listing_id', listingId);
      }
      await supabase
        .from('tour_days')
        .update({
          encoded_polyline: result.encodedPolyline ?? null,
          // Match page freshness check: all stop listing ids, not visit order.
          route_signature: routeSignatureForListingIds(listingIds),
        })
        .eq('id', tourDayId);
    }

    return Response.json({
      ok: true,
      ...result,
      customStart: customStart
        ? { ...customStart, address: customStartAddress || null }
        : null,
      customEnd: customEnd ? { ...customEnd, address: customEndAddress || null } : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Optimize failed';
    return Response.json({ error: message }, { status: 500 });
  }
};
