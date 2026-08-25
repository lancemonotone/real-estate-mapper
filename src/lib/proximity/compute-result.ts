import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRouteMatrix } from '../google/route-matrix';
import type { Database, ProximityResult, TravelMode } from '../types/database';
import {
  evaluateCriterionProximity,
  type ProximityOutcome,
} from './compute-core';
import { isLocalePoiExcluded, pairsToRecomputeAfterExclude } from './exclusions';
import { googleMapsDirectionsUrl } from './maps-url';

type Client = SupabaseClient<Database>;

export type ProximityResultRow = ProximityResult;

export function shouldRefreshLockedRoute(row: {
  locked: boolean;
  status: string;
  place_lat: number | null;
  place_lng: number | null;
  place_id: string | null;
  place_name: string | null;
}): boolean {
  return (
    row.locked === true &&
    row.status === 'ok' &&
    row.place_lat != null &&
    row.place_lng != null &&
    row.place_id != null &&
    row.place_name != null
  );
}

/** True when a stored result already has a usable destination (skip Google). */
export function isCachedOkProximityResult(row: {
  status: string;
  place_lat: number | null;
  place_lng: number | null;
  place_id: string | null;
}): boolean {
  return (
    row.status === 'ok' &&
    row.place_lat != null &&
    row.place_lng != null &&
    typeof row.place_id === 'string' &&
    row.place_id.length > 0
  );
}

async function upsertResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
  row: ProximityOutcome,
  locked: boolean,
): Promise<ProximityResultRow> {
  const payload = {
    listing_id: listingId,
    criterion_id: criterionId,
    status: row.status,
    place_id: row.place_id,
    place_name: row.place_name,
    place_lat: row.place_lat,
    place_lng: row.place_lng,
    duration_sec: row.duration_sec,
    distance_m: row.distance_m,
    maps_url: row.maps_url,
    error_message: row.error_message,
    locked,
    computed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('proximity_results')
    .upsert(payload, { onConflict: 'listing_id,criterion_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to upsert proximity_results');
  }
  return data;
}

async function refreshLockedRoute(
  supabase: Client,
  listingId: string,
  criterionId: string,
  existing: ProximityResultRow,
  travelMode: TravelMode,
): Promise<ProximityResultRow> {
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('lat, lng')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? 'Listing not found');
  }
  if (listing.lat == null || listing.lng == null) {
    return upsertResult(
      supabase,
      listingId,
      criterionId,
      {
        status: 'needs_geocode',
        place_id: existing.place_id,
        place_name: existing.place_name,
        place_lat: existing.place_lat,
        place_lng: existing.place_lng,
        duration_sec: null,
        distance_m: null,
        maps_url: null,
        error_message: null,
      },
      true,
    );
  }

  const origin = { lat: listing.lat, lng: listing.lng };
  const dest = {
    lat: existing.place_lat!,
    lng: existing.place_lng!,
    placeId: existing.place_id,
    name: existing.place_name,
  };

  try {
    const legs = await computeRouteMatrix({
      origin,
      destinations: [{ lat: dest.lat, lng: dest.lng }],
      travelMode,
    });
    const leg = legs.find((l) => l.destinationIndex === 0 && l.ok);
    if (!leg) {
      return upsertResult(
        supabase,
        listingId,
        criterionId,
        {
          status: 'error',
          place_id: existing.place_id,
          place_name: existing.place_name,
          place_lat: existing.place_lat,
          place_lng: existing.place_lng,
          duration_sec: null,
          distance_m: null,
          maps_url: null,
          error_message: 'No route to locked place',
        },
        true,
      );
    }

    return upsertResult(
      supabase,
      listingId,
      criterionId,
      {
        status: 'ok',
        place_id: existing.place_id,
        place_name: existing.place_name,
        place_lat: existing.place_lat,
        place_lng: existing.place_lng,
        duration_sec: Math.round(leg.durationSec),
        distance_m: Math.round(leg.distanceM),
        maps_url: googleMapsDirectionsUrl({
          origin,
          destination: dest,
          travelMode,
        }),
        error_message: null,
      },
      true,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Route matrix failed';
    return upsertResult(
      supabase,
      listingId,
      criterionId,
      {
        status: 'error',
        place_id: existing.place_id,
        place_name: existing.place_name,
        place_lat: existing.place_lat,
        place_lng: existing.place_lng,
        duration_sec: null,
        distance_m: null,
        maps_url: null,
        error_message: message,
      },
      true,
    );
  }
}

export async function computeProximityResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
  opts?: { force?: boolean; unlock?: boolean },
): Promise<ProximityResultRow & { candidates?: ProximityOutcome['candidates'] }> {
  const { data: criterion, error: criterionError } = await supabase
    .from('proximity_criteria')
    .select('*')
    .eq('id', criterionId)
    .single();

  if (criterionError || !criterion) {
    throw new Error(criterionError?.message ?? 'Criterion not found');
  }

  const { data: existing } = await supabase
    .from('proximity_results')
    .select('*')
    .eq('listing_id', listingId)
    .eq('criterion_id', criterionId)
    .maybeSingle();

  // Prefer DB cache — do not re-hit Google on every compute when we already have a place.
  // Locked rows keep their place even if it was later excluded.
  // Unlocked rows with an excluded place must recompute.
  if (existing && isCachedOkProximityResult(existing) && !opts?.force) {
    const keepCache =
      existing.locked === true ||
      criterion.kind !== 'place_type' ||
      !criterion.place_type_key ||
      !existing.place_id ||
      !(await isLocalePoiExcluded(
        supabase,
        criterion.locale_id,
        criterion.place_type_key,
        existing.place_id,
      ));
    if (keepCache) {
      return existing;
    }
  }

  const outcome = await evaluateCriterionProximity(supabase, listingId, criterion);
  const locked = opts?.unlock === true ? false : (existing?.locked ?? false);
  const row = await upsertResult(
    supabase,
    listingId,
    criterionId,
    outcome,
    locked,
  );
  return { ...row, candidates: outcome.candidates };
}

/**
 * Persist a locale + place-type exclusion, then force-recompute unlocked
 * proximity_results that currently use that place for matching criteria.
 * When `source` is set (the cell the user banned from), that pair is always
 * unlocked and recomputed even if it was locked.
 */
export async function excludeLocalePoiAndRecompute(
  supabase: Client,
  input: {
    localeId: string;
    placeTypeKey: string;
    placeId: string;
    sourceListingId?: string;
    sourceCriterionId?: string;
  },
): Promise<{ results: ProximityResultRow[] }> {
  const localeId = input.localeId.trim();
  const placeTypeKey = input.placeTypeKey.trim();
  const placeId = input.placeId.trim();
  const sourceListingId = input.sourceListingId?.trim() || '';
  const sourceCriterionId = input.sourceCriterionId?.trim() || '';

  if (!localeId || !placeTypeKey || !placeId) {
    throw new Error('locale_id, place_type_key, and place_id required');
  }

  const { error: upsertError } = await supabase
    .from('locale_poi_exclusions')
    .upsert(
      {
        locale_id: localeId,
        place_type_key: placeTypeKey,
        place_id: placeId,
      },
      { onConflict: 'locale_id,place_type_key,place_id' },
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('proximity_criteria')
    .select('id')
    .eq('locale_id', localeId)
    .eq('kind', 'place_type')
    .eq('place_type_key', placeTypeKey);

  if (criteriaError) {
    throw new Error(criteriaError.message);
  }

  const criterionIds = (criteria ?? []).map((c) => c.id);
  if (criterionIds.length === 0) {
    return { results: [] };
  }

  const { data: affected, error: resultsError } = await supabase
    .from('proximity_results')
    .select('listing_id, criterion_id')
    .in('criterion_id', criterionIds)
    .eq('place_id', placeId)
    .eq('locked', false);

  if (resultsError) {
    throw new Error(resultsError.message);
  }

  const source =
    sourceListingId && sourceCriterionId
      ? { listing_id: sourceListingId, criterion_id: sourceCriterionId }
      : null;

  const pairs = pairsToRecomputeAfterExclude(affected ?? [], source);
  const results: ProximityResultRow[] = [];
  for (const row of pairs) {
    const unlock =
      source != null &&
      row.listing_id === source.listing_id &&
      row.criterion_id === source.criterion_id;
    results.push(
      await computeProximityResult(supabase, row.listing_id, row.criterion_id, {
        force: true,
        unlock,
      }),
    );
  }

  return { results };
}

export async function setProximityResultLock(
  supabase: Client,
  listingId: string,
  criterionId: string,
  locked: boolean,
): Promise<ProximityResultRow> {
  const { data, error } = await supabase
    .from('proximity_results')
    .update({ locked })
    .eq('listing_id', listingId)
    .eq('criterion_id', criterionId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update lock');
  }
  return data;
}

export async function upsertLockedProximityResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
  place: {
    place_id: string;
    place_name: string;
    place_lat: number;
    place_lng: number;
    duration_sec: number;
    distance_m: number;
    maps_url: string;
  },
): Promise<ProximityResultRow> {
  return upsertResult(
    supabase,
    listingId,
    criterionId,
    {
      status: 'ok',
      place_id: place.place_id,
      place_name: place.place_name,
      place_lat: place.place_lat,
      place_lng: place.place_lng,
      duration_sec: place.duration_sec,
      distance_m: place.distance_m,
      maps_url: place.maps_url,
      error_message: null,
    },
    true,
  );
}

export async function computeStaleForLocale(
  supabase: Client,
  localeId: string,
): Promise<ProximityResultRow[]> {
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id, updated_at')
    .eq('locale_id', localeId);

  if (listingsError) {
    throw new Error(listingsError.message);
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('proximity_criteria')
    .select('id')
    .eq('locale_id', localeId);

  if (criteriaError) {
    throw new Error(criteriaError.message);
  }

  if (!listings?.length || !criteria?.length) {
    return [];
  }

  const listingIds = listings.map((l) => l.id);
  const { data: existing, error: resultsError } = await supabase
    .from('proximity_results')
    .select('listing_id, criterion_id, computed_at')
    .in('listing_id', listingIds);

  if (resultsError) {
    throw new Error(resultsError.message);
  }

  const resultKey = (listingId: string, criterionId: string) =>
    `${listingId}:${criterionId}`;
  const computedAtByPair = new Map<string, string>();
  for (const row of existing ?? []) {
    computedAtByPair.set(
      resultKey(row.listing_id, row.criterion_id),
      row.computed_at,
    );
  }

  const listingUpdated = new Map(
    listings.map((l) => [l.id, l.updated_at] as const),
  );

  const results: ProximityResultRow[] = [];
  for (const listing of listings) {
    for (const criterion of criteria) {
      const key = resultKey(listing.id, criterion.id);
      const computedAt = computedAtByPair.get(key);
      const updatedAt = listingUpdated.get(listing.id);
      const stale =
        computedAt == null ||
        (updatedAt != null && updatedAt > computedAt);
      if (!stale) continue;
      results.push(
        await computeProximityResult(supabase, listing.id, criterion.id),
      );
    }
  }

  return results;
}
