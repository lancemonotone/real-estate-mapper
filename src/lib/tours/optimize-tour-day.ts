import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildFixedOrderPlan,
  buildOptimizePlan,
} from '../google/optimize-request';
import { computeOptimizedRoute } from '../google/routes';
import {
  dayHasAppointmentTimes,
  orderStopsForAutoroute,
} from './appointment-order';
import { routeSignatureForListingIds } from './route-signature';

type OptimizeOk = { ok: true };
type OptimizeErr = { ok: false; error: string; status: number };

/**
 * Recompute stop order, legs, and polyline for a tour day.
 * Uses DB custom start/end when present; otherwise the start listing.
 * When any stop has appointment_time, visit order is fixed (timed first).
 */
export async function optimizeTourDay(
  supabase: SupabaseClient,
  tourDayId: string,
  opts?: { startListingId?: string; preserveOrder?: boolean },
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
    .select('listing_id, is_start, sort_order, appointment_time')
    .eq('tour_day_id', tourDayId);
  if (stopsError) return { ok: false, error: stopsError.message, status: 400 };

  const listingIds = (stops ?? []).map((s) => s.listing_id);
  const startListingId =
    opts?.startListingId ??
    (stops ?? []).find((s) => s.is_start)?.listing_id ??
    undefined;

  const forOrderEarly = (stops ?? []).map((s) => ({
    listingId: s.listing_id,
    appointmentTime: (s.appointment_time as string | null) ?? null,
    sortOrder: s.sort_order as number | null,
  }));
  const useFixedOrderEarly = dayHasAppointmentTimes(forOrderEarly);

  if (!customStart && !startListingId && !useFixedOrderEarly) {
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

  const geocodedIds = new Set(geocoded.map((l) => l.id));
  const stopRows = (stops ?? []).filter((s) => geocodedIds.has(s.listing_id));
  const forOrder = stopRows.map((s) => ({
    listingId: s.listing_id,
    appointmentTime: (s.appointment_time as string | null) ?? null,
    sortOrder: s.sort_order,
  }));
  const useFixedOrder =
    Boolean(opts?.preserveOrder) || dayHasAppointmentTimes(forOrder);

  try {
    const listingById = new Map(geocoded.map((l) => [l.id, l]));
    let plan;
    let originListingId: string | null;

    if (useFixedOrder) {
      const ordered = orderStopsForAutoroute(forOrder);
      const stopsInVisitOrder = ordered.map((s) => {
        const listing = listingById.get(s.listingId)!;
        return { id: listing.id, lat: listing.lat!, lng: listing.lng! };
      });
      plan = buildFixedOrderPlan(stopsInVisitOrder, { customStart, customEnd });
      originListingId = plan.originId;
    } else {
      plan = buildOptimizePlan(
        geocoded.map((l) => ({
          id: l.id,
          lat: l.lat!,
          lng: l.lng!,
          isStart: !customStart && l.id === startListingId,
        })),
        { customStart, customEnd },
      );
      originListingId = plan.originId;
    }

    const result = await computeOptimizedRoute(plan);

    for (let fullIdx = 0; fullIdx < result.fullPathIds.length; fullIdx++) {
      const listingId = result.fullPathIds[fullIdx];
      if (!listingId) continue;
      const leg = result.legs[fullIdx];
      await supabase
        .from('tour_stops')
        .update({
          sort_order: result.orderedIds.indexOf(listingId),
          is_start: !customStart && listingId === originListingId,
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
        route_signature: routeSignatureForListingIds(listingIds),
      })
      .eq('id', tourDayId);

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Optimize failed';
    await supabase
      .from('tour_days')
      .update({ encoded_polyline: null, route_signature: null })
      .eq('id', tourDayId);
    return { ok: false, error: message, status: 500 };
  }
}
