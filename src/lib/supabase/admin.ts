import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { requireEnv } from '../env';

export function createSupabaseAdminClient() {
  return createClient<Database>(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
