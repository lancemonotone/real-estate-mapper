import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkAddTourDaysWithStopsBatch,
  loadNestEntitlements,
} from '../nest/entitlements';
import { loadDevHuntPassPreviewForUser } from '../dev/hunt-pass-preview';
import { getLocaleForNestMember } from '../supabase/nest';
import {
  AUTO_PLAN_MAX_PER_CLUSTER,
  AUTO_PLAN_RADIUS_MILES,
} from './cluster-listings';
import { planFillDateRange } from './fill-date-range';
import { selectUnscheduledGeocodedForAutoPlan } from './auto-plan-pool';
import { dateKeysInclusive } from './week';
import { milesToMeters } from '../geo/locale-radius';
import { ensureTourDayEndpointsFromLocaleDefaults } from './ensure-tour-endpoints';
import { optimizeTourDay } from './optimize-tour-day';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type BuildFillPreviewOptions = {
  favoritesOnly?: boolean;
};

export async function buildFillPreview(
  supabase: SupabaseClient,
  localeId: string,
  startDate: string,
  endDate: string,
  options: BuildFillPreviewOptions = {},
) {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { ok: false as const, error: 'startDate and endDate must be YYYY-MM-DD', status: 400 };
  }

  let rangeDates: string[];
  try {
    rangeDates = dateKeysInclusive(startDate, endDate);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Invalid date range',
      status: 400,
    };
  }

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) {
    return { ok: false as const, error: 'Locale not found', status: 404 };
  }

  const { data: allTours, error: toursError } = await supabase
    .from('tour_days')
    .select('id, tour_date')
    .eq('locale_id', locale.id);
  if (toursError) {
    return { ok: false as const, error: toursError.message, status: 400 };
  }

  const tourDayIds = (allTours ?? []).map((t) => t.id);
  const { data: assignedStops } =
    tourDayIds.length > 0
      ? await supabase.from('tour_stops').select('listing_id').in('tour_day_id', tourDayIds)
      : { data: [] as { listing_id: string }[] };
  const assignedIds = new Set((assignedStops ?? []).map((a) => a.listing_id));

  const { data: listings, error: listError } = await supabase
    .from('listings')
    .select('id, name, address, lat, lng, is_favorite')
    .eq('locale_id', locale.id);
  if (listError) {
    return { ok: false as const, error: listError.message, status: 400 };
  }

  const { geocoded, skippedMissingGeo, skippedNotFavorite } =
    selectUnscheduledGeocodedForAutoPlan(listings ?? [], assignedIds, {
      favoritesOnly: options.favoritesOnly === true,
    });

  const rangeSet = new Set(rangeDates);
  const toursInRange = (allTours ?? []).filter((t) => rangeSet.has(t.tour_date));
  const rangeTourIds = toursInRange.map((t) => t.id);

  const { data: rangeStops } =
    rangeTourIds.length > 0
      ? await supabase
          .from('tour_stops')
          .select('tour_day_id, listing_id, listings(lat, lng)')
          .in('tour_day_id', rangeTourIds)
      : { data: [] as never[] };

  const tourDateById = new Map(toursInRange.map((t) => [t.id, t.tour_date]));
  const existingByDate: Record<
    string,
    { listingId: string; lat: number; lng: number }[]
  > = {};
  for (const date of rangeDates) existingByDate[date] = [];

  for (const stop of rangeStops ?? []) {
    const tourDate = tourDateById.get(stop.tour_day_id);
    if (!tourDate) continue;
    const raw = stop.listings;
    const listing = (Array.isArray(raw) ? raw[0] : raw) as {
      lat: number | null;
      lng: number | null;
    } | null;
    if (listing?.lat == null || listing?.lng == null) continue;
    existingByDate[tourDate]!.push({
      listingId: stop.listing_id,
      lat: listing.lat,
      lng: listing.lng,
    });
  }

  const plan = planFillDateRange({
    rangeDates,
    existingByDate,
    unscheduled: geocoded.map((l) => ({
      id: l.id,
      lat: l.lat!,
      lng: l.lng!,
    })),
    radiusM: milesToMeters(AUTO_PLAN_RADIUS_MILES),
    maxPerDay: AUTO_PLAN_MAX_PER_CLUSTER,
  });

  const byId = new Map((listings ?? []).map((l) => [l.id, l]));
  const assignments = plan.assignments.map((a) => ({
    ...a,
    labels: a.listingIds.map((id) => {
      const row = byId.get(id);
      return row?.name || row?.address || id;
    }),
    existingCount: (existingByDate[a.tourDate] ?? []).length,
  }));

  const overflowLabels = plan.overflowIds.map((id) => {
    const row = byId.get(id);
    return row?.name || row?.address || id;
  });

  return {
    ok: true as const,
    localeId: locale.id,
    startDate,
    endDate,
    rangeDates,
    assignments,
    overflowIds: plan.overflowIds,
    overflowLabels,
    skippedMissingGeo,
    skippedNotFavorite,
    favoritesOnly: options.favoritesOnly === true,
    radiusMiles: AUTO_PLAN_RADIUS_MILES,
    maxPerDay: AUTO_PLAN_MAX_PER_CLUSTER,
    unscheduledGeocoded: geocoded.length,
  };
}

export async function applyFillDateRange(
  supabase: SupabaseClient,
  localeId: string,
  startDate: string,
  endDate: string,
  userId?: string,
  options: BuildFillPreviewOptions = {},
) {
  const preview = await buildFillPreview(supabase, localeId, startDate, endDate, options);
  if (!preview.ok) return preview;

  if (preview.assignments.length === 0) {
    const emptyMessage =
      preview.favoritesOnly && preview.unscheduledGeocoded === 0
        ? 'No favorited unscheduled geocoded listings to place.'
        : preview.unscheduledGeocoded === 0
          ? 'No unscheduled geocoded listings to place.'
          : 'Nothing to apply. All eligible listings overflowed or none left.';
    return {
      ok: true as const,
      tourDayIds: [] as string[],
      overflowIds: preview.overflowIds,
      optimized: [] as { tourDayId: string; ok: boolean; error?: string }[],
      message: emptyMessage,
    };
  }

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) {
    return { ok: false as const, error: 'Locale not found', status: 404 };
  }

  const devHuntPassPreview = userId
    ? await loadDevHuntPassPreviewForUser(supabase, userId)
    : false;
  const snapshot = await loadNestEntitlements(supabase, locale.nest_id, {
    devHuntPassPreview,
  });
  if (!snapshot) {
    return { ok: false as const, error: 'Nest not found', status: 404 };
  }

  const newTourDaysWithStops = preview.assignments.filter(
    (assignment) => assignment.existingCount === 0 && assignment.listingIds.length > 0,
  ).length;
  const batchCheck = checkAddTourDaysWithStopsBatch(snapshot, newTourDaysWithStops);
  if (!batchCheck.ok) {
    return { ok: false as const, error: batchCheck.message, status: 403 };
  }

  const touched: string[] = [];

  for (const group of preview.assignments) {
    const { data: tourDay, error } = await supabase
      .from('tour_days')
      .upsert(
        { locale_id: localeId, tour_date: group.tourDate },
        { onConflict: 'locale_id,tour_date' },
      )
      .select('id')
      .single();

    if (error || !tourDay) {
      return {
        ok: false as const,
        error: error?.message ?? `Could not open tour for ${group.tourDate}`,
        status: 400,
      };
    }

    if (group.existingCount === 0) {
      await ensureTourDayEndpointsFromLocaleDefaults(supabase, localeId, tourDay.id);
    }

    const { data: existingStops } = await supabase
      .from('tour_stops')
      .select('listing_id, sort_order')
      .eq('tour_day_id', tourDay.id)
      .order('sort_order', { ascending: true, nullsFirst: false });

    const existingIds = new Set((existingStops ?? []).map((s) => s.listing_id));
    const maxOrder = (existingStops ?? []).reduce(
      (m, s) => Math.max(m, s.sort_order ?? -1),
      -1,
    );

    const toInsert = group.listingIds.filter((id) => !existingIds.has(id));
    if (toInsert.length === 0) continue;

    const rows = toInsert.map((listingId, i) => ({
      tour_day_id: tourDay.id,
      listing_id: listingId,
      is_start: (existingStops ?? []).length === 0 && i === 0,
      sort_order: maxOrder + 1 + i,
      appointment_time: null,
    }));

    const { error: stopError } = await supabase.from('tour_stops').insert(rows);
    if (stopError) {
      return { ok: false as const, error: stopError.message, status: 400 };
    }

    touched.push(tourDay.id);
  }

  const optimized: { tourDayId: string; ok: boolean; error?: string }[] = [];
  for (const tourDayId of touched) {
    const opt = await optimizeTourDay(supabase, tourDayId);
    optimized.push(
      opt.ok
        ? { tourDayId, ok: true }
        : { tourDayId, ok: false, error: opt.error },
    );
  }

  return {
    ok: true as const,
    tourDayIds: touched,
    overflowIds: preview.overflowIds,
    optimized,
    assignments: preview.assignments,
  };
}
