import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { PoiCandidate } from './place-types';

type Client = SupabaseClient<Database>;

/** Drop POIs whose place_id is in the exclusion set (order preserved). */
export function withoutExcludedPois(
  pois: PoiCandidate[],
  excludedPlaceIds: Iterable<string>,
): PoiCandidate[] {
  const banned = new Set(
    [...excludedPlaceIds].filter((id) => typeof id === 'string' && id.length > 0),
  );
  if (banned.size === 0) return pois;
  return pois.filter((p) => !banned.has(p.placeId));
}

export async function loadExcludedPlaceIds(
  supabase: Client,
  localeId: string,
  placeTypeKey: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('locale_poi_exclusions')
    .select('place_id')
    .eq('locale_id', localeId)
    .eq('place_type_key', placeTypeKey);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.place_id);
}

export async function isLocalePoiExcluded(
  supabase: Client,
  localeId: string,
  placeTypeKey: string,
  placeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('locale_poi_exclusions')
    .select('place_id')
    .eq('locale_id', localeId)
    .eq('place_type_key', placeTypeKey)
    .eq('place_id', placeId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data != null;
}

export type RecomputePair = { listing_id: string; criterion_id: string };

/**
 * Unlocked rows that used the excluded place, plus the cell the user banned from
 * (even if that cell was locked — ban from a cell means that cell must move on).
 */
export function pairsToRecomputeAfterExclude(
  unlockedAffected: RecomputePair[],
  source: RecomputePair | null | undefined,
): RecomputePair[] {
  const key = (p: RecomputePair) => `${p.listing_id}:${p.criterion_id}`;
  const map = new Map<string, RecomputePair>();
  for (const p of unlockedAffected) {
    if (p.listing_id && p.criterion_id) map.set(key(p), p);
  }
  if (source?.listing_id && source?.criterion_id) {
    map.set(key(source), source);
  }
  return [...map.values()];
}
