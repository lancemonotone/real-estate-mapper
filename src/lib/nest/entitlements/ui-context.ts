import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, NestRole } from '../../types/database';
import { listNestMembers } from '../../supabase/nest';
import type { EntitlementPlan } from './constants';
import { loadNestEntitlements } from './db';
import { isNestPro } from './resolve';

type Client = SupabaseClient<Database>;

export type NestEntitlementUi = {
  plan: EntitlementPlan;
  role: NestRole;
  isOwner: boolean;
  ownerDisplayName: string | null;
  passExpiresAt: string | null;
  daysUntilExpiry: number | null;
  showExpiryNag: boolean;
  hidden: {
    locales: number;
    listings: number;
    tourDays: number;
  };
  hiddenTotal: number;
  proximityRefreshRemaining: number;
};

export async function loadNestEntitlementUi(
  supabase: Client,
  nestId: string,
  userId: string,
): Promise<NestEntitlementUi | null> {
  const snapshot = await loadNestEntitlements(supabase, nestId);
  if (!snapshot) return null;

  const { data: member, error: memberError } = await supabase
    .from('nest_members')
    .select('role')
    .eq('nest_id', nestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (!member) return null;

  const members = await listNestMembers(supabase, nestId);
  const owner = members.find((row) => row.role === 'owner');

  let daysUntilExpiry: number | null = null;
  let showExpiryNag = false;
  const passExpiresAt = snapshot.billing.pass_expires_at;

  if (passExpiresAt && isNestPro(snapshot.billing)) {
    const ms = new Date(passExpiresAt).getTime() - Date.now();
    daysUntilExpiry = Math.ceil(ms / 86_400_000);
    showExpiryNag = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  }

  const hiddenTotal =
    snapshot.hidden.locales + snapshot.hidden.listings + snapshot.hidden.tourDays;

  return {
    plan: snapshot.plan,
    role: member.role as NestRole,
    isOwner: member.role === 'owner',
    ownerDisplayName: owner?.displayName ?? null,
    passExpiresAt,
    daysUntilExpiry,
    showExpiryNag,
    hidden: snapshot.hidden,
    hiddenTotal,
    proximityRefreshRemaining: snapshot.proximityRefreshRemaining,
  };
}
