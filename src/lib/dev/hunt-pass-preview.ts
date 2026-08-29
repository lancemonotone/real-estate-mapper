import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Client = SupabaseClient<Database>;

/** Dev tools are available in Astro dev or when explicitly enabled for staging. */
export function isDevToolsEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.PUBLIC_DEV_TOOLS === 'true';
}

export async function loadDevHuntPassPreviewForUser(
  supabase: Client,
  userId: string,
): Promise<boolean> {
  if (!isDevToolsEnabled()) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('dev_hunt_pass_preview')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.dev_hunt_pass_preview);
}
