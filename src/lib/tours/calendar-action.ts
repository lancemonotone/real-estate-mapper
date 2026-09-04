import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertNestEntitlement,
} from '../nest/entitlements';
import { partitionStopsForClearUntimed } from './clear-untimed';
import { ensureTourDayEndpointsFromLocaleDefaults } from './ensure-tour-endpoints';
import { optimizeTourDay } from './optimize-tour-day';

export type ConflictMode = 'merge' | 'replace';

export type CalendarAction =
  | { type: 'assign'; listingIds: string[]; tourDate: string; mode?: ConflictMode }
  | { type: 'unassign'; listingIds: string[]; tourDayId: string }
  | { type: 'clearUntimed'; tourDate: string }
  | { type: 'moveDay'; fromDate: string; toDate: string; mode?: ConflictMode }
  | { type: 'reorder'; tourDayId: string; listingIdsInOrder: string[] };

export type CalendarActionOk = {
  ok: true;
  tourDayId: string | null;
  optimized: boolean;
  optimizeError?: string;
  clearedCount?: number;
  keptTimedCount?: number;
};

export type CalendarActionErr = {
  ok: false;
  error: string;
  status: number;
};

export function resolveOccupiedDrop(
  targetHasStops: boolean,
  mode?: ConflictMode,
): 'create' | 'merge' | 'replace' | 'need-choice' {
  if (!targetHasStops) return 'create';
  if (!mode) return 'need-choice';
  return mode;
}

async function localeTourDayIds(
  supabase: SupabaseClient,
  localeId: string,
): Promise<string[]> {
  const { data } = await supabase.from('tour_days').select('id').eq('locale_id', localeId);
  return (data ?? []).map((t) => t.id);
}

async function stopCount(supabase: SupabaseClient, tourDayId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tour_stops')
    .select('listing_id', { count: 'exact', head: true })
    .eq('tour_day_id', tourDayId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function deleteEmptyDay(supabase: SupabaseClient, tourDayId: string): Promise<void> {
  if ((await stopCount(supabase, tourDayId)) > 0) return;
  const { error } = await supabase.from('tour_days').delete().eq('id', tourDayId);
  if (error) throw new Error(error.message);
}

/** Remove listings from any tour day in this locale; delete emptied days. */
async function detachListingsFromLocale(
  supabase: SupabaseClient,
  localeId: string,
  listingIds: string[],
  exceptTourDayId?: string,
): Promise<void> {
  if (listingIds.length === 0) return;
  const dayIds = await localeTourDayIds(supabase, localeId);
  const targets = exceptTourDayId ? dayIds.filter((id) => id !== exceptTourDayId) : dayIds;
  if (targets.length === 0) return;

  const { data: stops, error } = await supabase
    .from('tour_stops')
    .select('tour_day_id, listing_id')
    .in('tour_day_id', targets)
    .in('listing_id', listingIds);
  if (error) throw new Error(error.message);

  const touched = new Set<string>();
  for (const stop of stops ?? []) {
    touched.add(stop.tour_day_id);
    const { error: delError } = await supabase
      .from('tour_stops')
      .delete()
      .eq('tour_day_id', stop.tour_day_id)
      .eq('listing_id', stop.listing_id);
    if (delError) throw new Error(delError.message);
  }

  for (const dayId of touched) {
    await deleteEmptyDay(supabase, dayId);
  }
}

async function ensureStartThenOptimize(
  supabase: SupabaseClient,
  tourDayId: string,
): Promise<{ optimized: boolean; optimizeError?: string }> {
  const { data: tour } = await supabase
    .from('tour_days')
    .select('start_lat, start_lng')
    .eq('id', tourDayId)
    .single();

  const hasCustomStart = tour?.start_lat != null && tour?.start_lng != null;

  const { data: stops } = await supabase
    .from('tour_stops')
    .select('listing_id, is_start, sort_order')
    .eq('tour_day_id', tourDayId)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (!stops || stops.length === 0) {
    return { optimized: false };
  }

  let startListingId = stops.find((s) => s.is_start)?.listing_id;
  if (!hasCustomStart && !startListingId) {
    startListingId = stops[0]!.listing_id;
    await supabase
      .from('tour_stops')
      .update({ is_start: false })
      .eq('tour_day_id', tourDayId);
    await supabase
      .from('tour_stops')
      .update({ is_start: true })
      .eq('tour_day_id', tourDayId)
      .eq('listing_id', startListingId);
  }

  const result = await optimizeTourDay(
    supabase,
    tourDayId,
    startListingId ? { startListingId } : undefined,
  );
  if (!result.ok) {
    return { optimized: false, optimizeError: result.error };
  }
  return { optimized: true };
}

async function upsertDay(
  supabase: SupabaseClient,
  localeId: string,
  tourDate: string,
): Promise<{ id: string }> {
  const { data: tourDay, error } = await supabase
    .from('tour_days')
    .upsert({ locale_id: localeId, tour_date: tourDate }, { onConflict: 'locale_id,tour_date' })
    .select('id')
    .single();
  if (error || !tourDay) throw new Error(error?.message ?? 'Failed to upsert tour day');
  return tourDay;
}

async function assignListings(
  supabase: SupabaseClient,
  localeId: string,
  listingIds: string[],
  tourDate: string,
  mode: ConflictMode | undefined,
  opts?: {
    copyEndpointsFromDayId?: string;
    clearTargetEndpoints?: boolean;
    userId?: string;
  },
): Promise<CalendarActionOk | CalendarActionErr> {
  if (listingIds.length === 0) {
    return { ok: false, error: 'listingIds required', status: 400 };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
    return { ok: false, error: 'tourDate must be YYYY-MM-DD', status: 400 };
  }

  const { data: listingRows, error: listError } = await supabase
    .from('listings')
    .select('id')
    .eq('locale_id', localeId)
    .in('id', listingIds);
  if (listError) return { ok: false, error: listError.message, status: 400 };
  if ((listingRows ?? []).length !== listingIds.length) {
    return { ok: false, error: 'One or more listings are not in this Locale', status: 400 };
  }

  const { data: localeRow, error: localeError } = await supabase
    .from('locales')
    .select('nest_id')
    .eq('id', localeId)
    .single();
  if (localeError || !localeRow) {
    return { ok: false, error: localeError?.message ?? 'Locale not found', status: 400 };
  }

  const { data: existingDay } = await supabase
    .from('tour_days')
    .select('id')
    .eq('locale_id', localeId)
    .eq('tour_date', tourDate)
    .maybeSingle();

  const existingCount = existingDay ? await stopCount(supabase, existingDay.id) : 0;
  const entitlement = await assertNestEntitlement(
    supabase,
    localeRow.nest_id,
    'add_tour_day_with_stops',
    { targetTourDayStopCount: existingCount, userId: opts?.userId },
  );
  if ('denial' in entitlement) {
    return {
      ok: false,
      error: entitlement.denial.message,
      status: 403,
    };
  }

  const wasNewDay = !existingDay;
  const target = existingDay
    ? { id: existingDay.id }
    : await upsertDay(supabase, localeId, tourDate);
  if (wasNewDay) {
    await ensureTourDayEndpointsFromLocaleDefaults(supabase, localeId, target.id);
  }
  const resolution = resolveOccupiedDrop(existingCount > 0, mode);
  if (resolution === 'need-choice') {
    return { ok: false, error: 'need-choice', status: 409 };
  }

  if (resolution === 'replace') {
    const { error: clearError } = await supabase
      .from('tour_stops')
      .delete()
      .eq('tour_day_id', target.id);
    if (clearError) return { ok: false, error: clearError.message, status: 400 };
  }

  await detachListingsFromLocale(supabase, localeId, listingIds, target.id);

  for (const listingId of listingIds) {
    const { error: stopError } = await supabase.from('tour_stops').upsert(
      { tour_day_id: target.id, listing_id: listingId, is_start: false },
      { onConflict: 'tour_day_id,listing_id' },
    );
    if (stopError) return { ok: false, error: stopError.message, status: 400 };
  }

  if (opts?.clearTargetEndpoints || resolution === 'replace') {
    // replace: wipe target endpoints unless we copy from source below
    if (!opts?.copyEndpointsFromDayId) {
      await supabase
        .from('tour_days')
        .update({
          start_address: null,
          start_lat: null,
          start_lng: null,
          start_name: null,
          start_place_id: null,
          end_address: null,
          end_lat: null,
          end_lng: null,
          end_name: null,
          end_place_id: null,
          encoded_polyline: null,
          route_signature: null,
        })
        .eq('id', target.id);
    }
  } else {
    await supabase
      .from('tour_days')
      .update({ encoded_polyline: null, route_signature: null })
      .eq('id', target.id);
  }

  if (opts?.copyEndpointsFromDayId && opts.copyEndpointsFromDayId !== target.id) {
    const { data: source } = await supabase
      .from('tour_days')
      .select(
        'start_address, start_lat, start_lng, start_name, start_place_id, end_address, end_lat, end_lng, end_name, end_place_id',
      )
      .eq('id', opts.copyEndpointsFromDayId)
      .maybeSingle();
    if (source && (resolution === 'create' || resolution === 'replace')) {
      await supabase
        .from('tour_days')
        .update({
          ...source,
          encoded_polyline: null,
          route_signature: null,
        })
        .eq('id', target.id);
    }
  }

  const opt = await ensureStartThenOptimize(supabase, target.id);
  return {
    ok: true,
    tourDayId: target.id,
    optimized: opt.optimized,
    optimizeError: opt.optimizeError,
  };
}

export async function applyCalendarAction(
  supabase: SupabaseClient,
  localeId: string,
  action: CalendarAction,
  opts?: { userId?: string },
): Promise<CalendarActionOk | CalendarActionErr> {
  try {
    switch (action.type) {
      case 'assign':
        return await assignListings(
          supabase,
          localeId,
          action.listingIds,
          action.tourDate,
          action.mode,
          { userId: opts?.userId },
        );

      case 'unassign': {
        if (!action.tourDayId || action.listingIds.length === 0) {
          return { ok: false, error: 'tourDayId and listingIds required', status: 400 };
        }
        const { data: tourDay } = await supabase
          .from('tour_days')
          .select('id, locale_id')
          .eq('id', action.tourDayId)
          .maybeSingle();
        if (!tourDay || tourDay.locale_id !== localeId) {
          return { ok: false, error: 'Tour day not found', status: 404 };
        }

        for (const listingId of action.listingIds) {
          const { error } = await supabase
            .from('tour_stops')
            .delete()
            .eq('tour_day_id', action.tourDayId)
            .eq('listing_id', listingId);
          if (error) return { ok: false, error: error.message, status: 400 };
        }

        const remaining = await stopCount(supabase, action.tourDayId);
        if (remaining === 0) {
          await deleteEmptyDay(supabase, action.tourDayId);
          return { ok: true, tourDayId: null, optimized: false };
        }

        await supabase
          .from('tour_days')
          .update({ encoded_polyline: null, route_signature: null })
          .eq('id', action.tourDayId);
        const opt = await ensureStartThenOptimize(supabase, action.tourDayId);
        return {
          ok: true,
          tourDayId: action.tourDayId,
          optimized: opt.optimized,
          optimizeError: opt.optimizeError,
        };
      }

      case 'clearUntimed': {
        if (!action.tourDate) {
          return { ok: false, error: 'tourDate required', status: 400 };
        }
        const { data: tourDay } = await supabase
          .from('tour_days')
          .select('id, locale_id')
          .eq('locale_id', localeId)
          .eq('tour_date', action.tourDate)
          .maybeSingle();
        if (!tourDay || tourDay.locale_id !== localeId) {
          return {
            ok: true,
            tourDayId: null,
            optimized: false,
            clearedCount: 0,
            keptTimedCount: 0,
          };
        }

        const { data: stops, error: stopsError } = await supabase
          .from('tour_stops')
          .select('listing_id, appointment_time')
          .eq('tour_day_id', tourDay.id);
        if (stopsError) return { ok: false, error: stopsError.message, status: 400 };

        const { clearIds, keptTimedCount } = partitionStopsForClearUntimed(stops ?? []);
        if (clearIds.length === 0) {
          return {
            ok: true,
            tourDayId: tourDay.id,
            optimized: false,
            clearedCount: 0,
            keptTimedCount,
          };
        }

        const { error: deleteError } = await supabase
          .from('tour_stops')
          .delete()
          .eq('tour_day_id', tourDay.id)
          .in('listing_id', clearIds);
        if (deleteError) return { ok: false, error: deleteError.message, status: 400 };

        const remaining = await stopCount(supabase, tourDay.id);
        if (remaining === 0) {
          await deleteEmptyDay(supabase, tourDay.id);
          return {
            ok: true,
            tourDayId: null,
            optimized: false,
            clearedCount: clearIds.length,
            keptTimedCount: 0,
          };
        }

        await supabase
          .from('tour_days')
          .update({ encoded_polyline: null, route_signature: null })
          .eq('id', tourDay.id);
        const opt = await ensureStartThenOptimize(supabase, tourDay.id);
        return {
          ok: true,
          tourDayId: tourDay.id,
          optimized: opt.optimized,
          optimizeError: opt.optimizeError,
          clearedCount: clearIds.length,
          keptTimedCount,
        };
      }

      case 'moveDay': {
        if (action.fromDate === action.toDate) {
          const { data: day } = await supabase
            .from('tour_days')
            .select('id')
            .eq('locale_id', localeId)
            .eq('tour_date', action.fromDate)
            .maybeSingle();
          return { ok: true, tourDayId: day?.id ?? null, optimized: false };
        }

        const { data: fromDay } = await supabase
          .from('tour_days')
          .select('id')
          .eq('locale_id', localeId)
          .eq('tour_date', action.fromDate)
          .maybeSingle();
        if (!fromDay) {
          return { ok: false, error: 'Source tour day not found', status: 404 };
        }

        const { data: stops } = await supabase
          .from('tour_stops')
          .select('listing_id')
          .eq('tour_day_id', fromDay.id);
        const listingIds = (stops ?? []).map((s) => s.listing_id);
        if (listingIds.length === 0) {
          return { ok: false, error: 'Source day has no stops', status: 400 };
        }

        return await assignListings(supabase, localeId, listingIds, action.toDate, action.mode, {
          copyEndpointsFromDayId: fromDay.id,
          userId: opts?.userId,
        });
      }

      case 'reorder': {
        if (!action.tourDayId || action.listingIdsInOrder.length === 0) {
          return { ok: false, error: 'tourDayId and listingIdsInOrder required', status: 400 };
        }
        const { data: tourDay } = await supabase
          .from('tour_days')
          .select('id, locale_id')
          .eq('id', action.tourDayId)
          .maybeSingle();
        if (!tourDay || tourDay.locale_id !== localeId) {
          return { ok: false, error: 'Tour day not found', status: 404 };
        }

        for (let i = 0; i < action.listingIdsInOrder.length; i++) {
          const listingId = action.listingIdsInOrder[i]!;
          const { error } = await supabase
            .from('tour_stops')
            .update({ sort_order: i })
            .eq('tour_day_id', action.tourDayId)
            .eq('listing_id', listingId);
          if (error) return { ok: false, error: error.message, status: 400 };
        }

        await supabase
          .from('tour_days')
          .update({ encoded_polyline: null, route_signature: null })
          .eq('id', action.tourDayId);
        const opt = await ensureStartThenOptimize(supabase, action.tourDayId);
        return {
          ok: true,
          tourDayId: action.tourDayId,
          optimized: opt.optimized,
          optimizeError: opt.optimizeError,
        };
      }

      default: {
        const _exhaustive: never = action;
        return { ok: false, error: `Unknown action: ${JSON.stringify(_exhaustive)}`, status: 400 };
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Calendar action failed';
    return { ok: false, error: message, status: 500 };
  }
}
