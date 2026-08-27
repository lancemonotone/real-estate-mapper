import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import {
  incrementProximityRefreshUsed,
  recordProximityDemoUsed,
} from './db';
import type { NestEntitlementSnapshot } from './types';

type Client = SupabaseClient<Database>;

export async function recordProximityApiUsage(
  supabase: Client,
  nestId: string,
  snapshot: NestEntitlementSnapshot,
  kind: 'compute' | 'refresh',
): Promise<void> {
  if (snapshot.plan === 'pro' && kind === 'refresh') {
    await incrementProximityRefreshUsed(supabase, nestId);
    return;
  }
  if (snapshot.plan === 'free' && snapshot.proximityDemoAvailable) {
    await recordProximityDemoUsed(supabase, nestId);
  }
}
