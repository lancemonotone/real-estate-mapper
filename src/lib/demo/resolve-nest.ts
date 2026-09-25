import {
  ensureNestForUser,
  getPrimaryNestId,
} from '../supabase/nest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Client = SupabaseClient<Database>;

/**
 * Nest for the current request. Demo never creates a Nest.
 * Returns null when demo misconfigured or real user has no nest yet.
 */
export async function resolveAppNestId(
  locals: App.Locals,
  supabase: Client,
  userId: string,
): Promise<string | null> {
  if (locals.isDemo) {
    return locals.demoNestId ?? null;
  }
  let nestId = await getPrimaryNestId(supabase, userId);
  if (!nestId) {
    nestId = await ensureNestForUser(supabase, userId);
  }
  return nestId;
}
