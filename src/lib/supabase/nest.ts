import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteToken, hashInviteToken } from '../crypto/invite-token';
import { loadNestEntitlements } from '../nest/entitlements/db';
import type { NestEntitlementSnapshot } from '../nest/entitlements/types';
import type { Database, Locale, NestMemberProfile, NestRole } from '../types/database';

type Client = SupabaseClient<Database>;

export function isInviteRedirect(path: string): boolean {
  return path.startsWith('/invite/');
}

export function localeNeedsSetup(
  locale: Pick<Locale, 'center_lat' | 'center_lng'>,
): boolean {
  return locale.center_lat === 0 && locale.center_lng === 0;
}

export async function ensureNestForUser(supabase: Client, userId: string) {
  const { data: existing, error: memberError } = await supabase
    .from('nest_members')
    .select('nest_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (existing?.nest_id) return existing.nest_id;

  const { hash } = generateInviteToken();
  const { data: nestId, error: rpcError } = await supabase.rpc('create_nest', {
    p_invite_token_hash: hash,
  });

  if (rpcError) throw new Error(rpcError.message);
  if (!nestId) throw new Error('Nest bootstrap returned no id');
  return nestId as string;
}

export async function getPrimaryNestId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('nest_members')
    .select('nest_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return null;
  if (data.length === 1) return data[0].nest_id;

  // Prefer a nest joined via invite (member) over a solo owner bootstrap nest.
  const invitedNest = data.find((row) => row.role === 'member');
  return invitedNest?.nest_id ?? data[0].nest_id;
}

export async function joinNestFromInvite(
  supabase: Client,
  userId: string,
  rawToken: string,
): Promise<{ joined: boolean; nestId: string | null; error: string | null }> {
  const tokenHash = hashInviteToken(rawToken);
  const { data: nestId, error: nestError } = await supabase.rpc('nest_id_for_invite', {
    token_hash: tokenHash,
  });

  if (nestError) {
    return { joined: false, nestId: null, error: nestError.message };
  }
  if (!nestId) {
    return { joined: false, nestId: null, error: 'Invalid or expired invite link.' };
  }

  const { error: joinError } = await supabase.from('nest_members').insert({
    nest_id: nestId,
    user_id: userId,
    role: 'member',
  });

  if (joinError) {
    if (joinError.code === '23505') {
      return { joined: true, nestId, error: null };
    }
    return { joined: false, nestId: null, error: joinError.message };
  }

  return { joined: true, nestId, error: null };
}

export async function listLocalesForNest(supabase: Client, nestId: string) {
  const { data, error } = await supabase
    .from('locales')
    .select('*')
    .eq('nest_id', nestId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Locale[];
}

export async function listNestMembers(
  supabase: Client,
  nestId: string,
): Promise<NestMemberProfile[]> {
  const { data: members, error } = await supabase
    .from('nest_members')
    .select('user_id, role, created_at')
    .eq('nest_id', nestId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  if (!members?.length) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);

  if (profileError) throw new Error(profileError.message);

  const displayNameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name] as const),
  );

  return members.map((member) => ({
    userId: member.user_id,
    role: member.role as NestRole,
    displayName: displayNameById.get(member.user_id) ?? null,
    createdAt: member.created_at,
  }));
}

export async function getLocaleForNestMember(
  supabase: Client,
  localeId: string,
) {
  const { data, error } = await supabase
    .from('locales')
    .select('*')
    .eq('id', localeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Locale | null) ?? null;
}

export type VisibleLocaleContext = {
  locale: Locale;
  snapshot: NestEntitlementSnapshot;
};

/** Locale the member can access and that is visible under Nest entitlements. */
export async function getVisibleLocaleContext(
  supabase: Client,
  localeId: string,
  devHuntPassPreview = false,
): Promise<VisibleLocaleContext | null> {
  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) return null;

  const snapshot = await loadNestEntitlements(supabase, locale.nest_id, {
    devHuntPassPreview,
  });
  if (!snapshot || !snapshot.visibleLocaleIds.has(localeId)) return null;

  return { locale, snapshot };
}
