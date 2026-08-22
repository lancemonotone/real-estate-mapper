import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_LOCALE_PADDING_M,
  expandRadiusToInclude,
} from './locale-area';
import { invalidateLocaleProximityCache } from '../proximity/invalidate';
import type { Database } from '../types/database';

type Client = SupabaseClient<Database>;

export async function ensureLocaleCoversPoint(
  supabase: Client,
  localeId: string,
  point: { lat: number; lng: number },
) {
  const { data: locale, error } = await supabase
    .from('locales')
    .select('id, center_lat, center_lng, radius_m')
    .eq('id', localeId)
    .single();
  if (error || !locale) throw new Error(error?.message ?? 'Locale not found');

  const nextRadius = expandRadiusToInclude(
    { lat: locale.center_lat, lng: locale.center_lng },
    locale.radius_m,
    point,
    DEFAULT_LOCALE_PADDING_M,
  );
  if (nextRadius === locale.radius_m) return locale.radius_m;

  const { error: updateError } = await supabase
    .from('locales')
    .update({
      radius_m: nextRadius,
      updated_at: new Date().toISOString(),
    })
    .eq('id', localeId);
  if (updateError) throw new Error(updateError.message);

  await invalidateLocaleProximityCache(supabase, localeId);
  return nextRadius;
}
