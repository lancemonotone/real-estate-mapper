import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Client = SupabaseClient<Database>;

function envFlag(name: string): boolean {
  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const fromProcess =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  return (fromImportMeta ?? fromProcess) === 'true';
}

/** Dev tools are available in Astro dev or when explicitly enabled on the host. */
export function isDevToolsEnabled(): boolean {
  return (
    import.meta.env.DEV || envFlag('PUBLIC_DEV_TOOLS') || envFlag('DEV_TOOLS')
  );
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
