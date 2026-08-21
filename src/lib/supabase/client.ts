import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';
import { requireEnv } from '../env';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  );
}
