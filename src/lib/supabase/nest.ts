import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteToken } from '../crypto/invite-token';
import type { Database, Locale } from '../types/database';

type Client = SupabaseClient<Database>;

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
  const { data: nestId, error: rpcError } = await supabase.rpc(
    'create_household_nest',
    { p_invite_token_hash: hash },
  );

  if (rpcError) throw new Error(rpcError.message);
  if (!nestId) throw new Error('Nest bootstrap returned no id');
  return nestId as string;
}

export async function getPrimaryNestId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('nest_members')
    .select('nest_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.nest_id ?? null;
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
