import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { ENTITLEMENT_ERROR_CODE } from './constants';
import {
  checkEntitlementGate,
  resolveNestEntitlements,
  type EntitlementGate,
} from './resolve';
import type { EntitlementDenial, NestBillingRow, NestEntitlementSnapshot } from './types';

type Client = SupabaseClient<Database>;

export async function loadNestBilling(
  supabase: Client,
  nestId: string,
): Promise<NestBillingRow | null> {
  const { data, error } = await supabase
    .from('nests')
    .select(
      'pass_started_at, pass_expires_at, proximity_refresh_granted, proximity_refresh_used',
    )
    .eq('id', nestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    pass_started_at: data.pass_started_at,
    pass_expires_at: data.pass_expires_at,
    proximity_refresh_granted: data.proximity_refresh_granted,
    proximity_refresh_used: data.proximity_refresh_used,
  };
}

async function loadTourDaysWithStopCounts(
  supabase: Client,
  localeIds: string[],
): Promise<Array<{ id: string; locale_id: string; created_at: string; stop_count: number }>> {
  if (localeIds.length === 0) return [];

  const { data: days, error } = await supabase
    .from('tour_days')
    .select('id, locale_id, created_at')
    .in('locale_id', localeIds);

  if (error) throw new Error(error.message);
  if (!days?.length) return [];

  const dayIds = days.map((day) => day.id);
  const { data: stops, error: stopError } = await supabase
    .from('tour_stops')
    .select('tour_day_id')
    .in('tour_day_id', dayIds);

  if (stopError) throw new Error(stopError.message);

  const counts = new Map<string, number>();
  for (const stop of stops ?? []) {
    counts.set(stop.tour_day_id, (counts.get(stop.tour_day_id) ?? 0) + 1);
  }

  return days.map((day) => ({
    id: day.id,
    locale_id: day.locale_id,
    created_at: day.created_at,
    stop_count: counts.get(day.id) ?? 0,
  }));
}

export async function loadNestEntitlements(
  supabase: Client,
  nestId: string,
): Promise<NestEntitlementSnapshot | null> {
  const billing = await loadNestBilling(supabase, nestId);
  if (!billing) return null;

  const { data: locales, error: localeError } = await supabase
    .from('locales')
    .select('id, created_at')
    .eq('nest_id', nestId)
    .order('created_at', { ascending: true });

  if (localeError) throw new Error(localeError.message);

  const localeRows = locales ?? [];
  const localeIds = localeRows.map((locale) => locale.id);

  let listingRows: Array<{
    id: string;
    locale_id: string;
    created_at: string;
    archived_at: string | null;
  }> = [];

  if (localeIds.length > 0) {
    const { data: listings, error: listingError } = await supabase
      .from('listings')
      .select('id, locale_id, created_at, archived_at')
      .in('locale_id', localeIds);

    if (listingError) throw new Error(listingError.message);
    listingRows = listings ?? [];
  }

  const tourDays = await loadTourDaysWithStopCounts(supabase, localeIds);

  let routeSearchCriteria: Array<{ locale_id: string }> = [];
  if (localeIds.length > 0) {
    const { data: criteria, error: criteriaError } = await supabase
      .from('proximity_criteria')
      .select('locale_id')
      .in('locale_id', localeIds);

    if (criteriaError) throw new Error(criteriaError.message);
    routeSearchCriteria = criteria ?? [];
  }

  return resolveNestEntitlements({
    billing,
    locales: localeRows,
    listings: listingRows,
    tourDays,
    routeSearchCriteria,
  });
}

export async function assertNestEntitlement(
  supabase: Client,
  nestId: string,
  gate: EntitlementGate,
  context?: {
    listingId?: string;
    localeId?: string;
    photoCount?: number;
    targetTourDayStopCount?: number;
  },
): Promise<NestEntitlementSnapshot | { denial: EntitlementDenial }> {
  const snapshot = await loadNestEntitlements(supabase, nestId);
  if (!snapshot) {
    return {
      denial: {
        ok: false,
        code: ENTITLEMENT_ERROR_CODE,
        message: 'Nest not found.',
      },
    };
  }

  const result = checkEntitlementGate(snapshot, gate, context);
  if (!result.ok) return { denial: result };
  return snapshot;
}

export async function incrementProximityRefreshUsed(
  supabase: Client,
  nestId: string,
): Promise<void> {
  const billing = await loadNestBilling(supabase, nestId);
  if (!billing) throw new Error('Nest not found');

  const { error } = await supabase
    .from('nests')
    .update({ proximity_refresh_used: billing.proximity_refresh_used + 1 })
    .eq('id', nestId);

  if (error) throw new Error(error.message);
}
