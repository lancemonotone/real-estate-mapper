import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Client = SupabaseClient<Database>;

/** Delete locale POI cache and all proximity_results for criteria in that locale. */
export async function invalidateLocaleProximityCache(
  supabase: Client,
  localeId: string,
): Promise<void> {
  const { error: poisError } = await supabase
    .from('locale_pois')
    .delete()
    .eq('locale_id', localeId);
  if (poisError) throw new Error(poisError.message);

  const { data: criteria, error: criteriaError } = await supabase
    .from('proximity_criteria')
    .select('id')
    .eq('locale_id', localeId);
  if (criteriaError) throw new Error(criteriaError.message);

  const criterionIds = (criteria ?? []).map((c) => c.id);
  if (criterionIds.length === 0) return;

  const { error: resultsError } = await supabase
    .from('proximity_results')
    .delete()
    .in('criterion_id', criterionIds);
  if (resultsError) throw new Error(resultsError.message);
}

/** Delete proximity_results for a single listing (e.g. after lat/lng change). */
export async function invalidateListingProximityResults(
  supabase: Client,
  listingId: string,
): Promise<void> {
  const { error } = await supabase
    .from('proximity_results')
    .delete()
    .eq('listing_id', listingId);
  if (error) throw new Error(error.message);
}
