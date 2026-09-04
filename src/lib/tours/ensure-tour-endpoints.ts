import type { SupabaseClient } from '@supabase/supabase-js';
import {
  tourDayEndpointPatchFromLocaleDefaults,
  type LocaleDefaultEndpointFields,
  type TourDayEndpointFields,
} from './locale-default-endpoints';

const LOCALE_DEFAULT_SELECT =
  'default_start_address, default_start_lat, default_start_lng, default_start_name, default_start_place_id, default_end_address, default_end_lat, default_end_lng, default_end_name, default_end_place_id';

const DAY_ENDPOINT_SELECT =
  'id, start_address, start_lat, start_lng, start_name, start_place_id, end_address, end_lat, end_lng, end_name, end_place_id';

export async function loadLocaleDefaultEndpoints(
  supabase: SupabaseClient,
  localeId: string,
): Promise<LocaleDefaultEndpointFields | null> {
  const { data, error } = await supabase
    .from('locales')
    .select(LOCALE_DEFAULT_SELECT)
    .eq('id', localeId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LocaleDefaultEndpointFields;
}

/** Copy Locale defaults onto a tour day where start/end are still empty. */
export async function ensureTourDayEndpointsFromLocaleDefaults(
  supabase: SupabaseClient,
  localeId: string,
  tourDayId: string,
): Promise<void> {
  const [{ data: day }, locale] = await Promise.all([
    supabase.from('tour_days').select(DAY_ENDPOINT_SELECT).eq('id', tourDayId).maybeSingle(),
    loadLocaleDefaultEndpoints(supabase, localeId),
  ]);
  if (!day || !locale) return;

  const patch = tourDayEndpointPatchFromLocaleDefaults(
    day as TourDayEndpointFields,
    locale,
  );
  if (Object.keys(patch).length === 0) return;

  await supabase.from('tour_days').update(patch).eq('id', day.id);
}

/** Fill start/end on every tour day in the Locale that is still missing that side. */
export async function ensureAllTourDayEndpointsFromLocaleDefaults(
  supabase: SupabaseClient,
  localeId: string,
): Promise<void> {
  const locale = await loadLocaleDefaultEndpoints(supabase, localeId);
  if (!locale) return;

  const { data: days, error } = await supabase
    .from('tour_days')
    .select(DAY_ENDPOINT_SELECT)
    .eq('locale_id', localeId);
  if (error || !days?.length) return;

  for (const day of days) {
    const patch = tourDayEndpointPatchFromLocaleDefaults(
      day as TourDayEndpointFields,
      locale,
    );
    if (Object.keys(patch).length === 0) continue;
    await supabase.from('tour_days').update(patch).eq('id', day.id);
  }
}
