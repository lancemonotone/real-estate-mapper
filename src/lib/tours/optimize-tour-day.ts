import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOptimizePlan } from '../google/optimize-request';
import { computeOptimizedRoute } from '../google/routes';

type OptimizeOk = { ok: true };
type OptimizeErr = { ok: false; error: string; status: number };

/**
 * Recompute stop order, legs, and polyline for a tour day.
 * Uses DB custom start/end when present; otherwise the start listing.
 */
export async function optimizeTourDay(
  supabase: SupabaseClient,
  tourDayId: string,
  opts?: { startListingId?: string },
): Promise<OptimizeOk | OptimizeErr> {
  const { data: tour, error: tourError } = await supabase
    .from('tour_days')
    .select('start_lat, start_lng, end_lat, end_lng')
    .eq('id', tourDayId)
    .single();
  if (tourError) return { ok: false, error: tourError.message, status: 400 };

  const customStart =
    tour?.start_lat != null && tour?.start_lng != null
      ? { lat: tour.start_lat, lng: tour.start_lng }
      : null;
  const customEnd =
    tour?.end_lat != null && tour?.end_lng != null
      ? { lat: tour.end_lat, lng: tour.end_lng }
      : null;

  const { data: stops, error: stopsError } = await supabase
    .from('tour_stops')
    .select('listing_id, is_start')
    .eq('tour_day_id', tourDayId);
  if (stopsError) return { ok: false, error: stopsError.message, status: 400 };

  const listingIds = (stops ?? []).map((s) => s.listing_id);
  const startListingId =
    opts?.startListingId ??
    (stops ?? []).find((s) => s.is_start)?.listing_id ??
    undefined;

  if (!customStart && !startListingId) {
    return {
      ok: false,
      error: 'Set a start listing or a custom start address',
      status: 400,
    };
  }

  const { data: listings, error: listError } = await supabase
    .from('listings')
    .select('id, lat, lng')
    .in('id', listingIds);
  if (listError) return { ok: false, error: listError.message, status: 400 };

  const geocoded = (listings ?? []).filter((l) => l.lat != null && l.lng != null);
  if (geocoded.length < 1) {
    return {
      ok: false,
      error: 'Optimize requires at least 1 geocoded listing',
      status: 400,
    };
  }

  try {
    const plan = buildOptimizePlan(
      geocoded.map((l) => ({
        id: l.id,
        lat: l.lat!,
        lng: l.lng!,
        isStart: !customStart && l.id === startListingId,
      })),
      { customStart, customEnd },
    );
    const result = await computeOptimizedRoute(plan);

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
      .update({ encoded_polyline: result.encodedPolyline ?? null })
      .eq('id', tourDayId);

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Optimize failed';
    return { ok: false, error: message, status: 500 };
  }
}
