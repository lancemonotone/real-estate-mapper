import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * listing_id → tour_date (YYYY-MM-DD) for stops in this locale.
 * If a listing appears on multiple days, the earliest date wins (Fail Fast: one color).
 */
export async function loadListingTourDatesByLocale(
  supabase: SupabaseClient,
  localeId: string,
): Promise<Map<string, string>> {
  const { data: days, error: daysError } = await supabase
    .from('tour_days')
    .select('id, tour_date')
    .eq('locale_id', localeId);
  if (daysError) throw new Error(daysError.message);

  const dayDate = new Map<string, string>();
  for (const day of days ?? []) {
    if (day.id && day.tour_date) dayDate.set(day.id, day.tour_date as string);
  }
  if (dayDate.size === 0) return new Map();

  const { data: stops, error: stopsError } = await supabase
    .from('tour_stops')
    .select('listing_id, tour_day_id')
    .in('tour_day_id', [...dayDate.keys()]);
  if (stopsError) throw new Error(stopsError.message);

  const out = new Map<string, string>();
  for (const stop of stops ?? []) {
    const listingId = stop.listing_id as string;
    const tourDate = dayDate.get(stop.tour_day_id as string);
    if (!listingId || !tourDate) continue;
    const prev = out.get(listingId);
    if (!prev || tourDate < prev) out.set(listingId, tourDate);
  }
  return out;
}
