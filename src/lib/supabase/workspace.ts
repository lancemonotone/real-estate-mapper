import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteToken } from '../crypto/invite-token';
import type { Database } from '../types/database';

type Client = SupabaseClient<Database>;

export async function ensureWorkspaceForUser(supabase: Client, userId: string) {
  const { data: existing, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (existing?.workspace_id) return existing.workspace_id;

  const { hash } = generateInviteToken();
  const { data: workspaceId, error: rpcError } = await supabase.rpc(
    'create_household_workspace',
    { p_invite_token_hash: hash },
  );

  if (rpcError) throw new Error(rpcError.message);
  if (!workspaceId) throw new Error('Workspace bootstrap returned no id');
  return workspaceId as string;
}

export async function getPrimaryWorkspaceId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.workspace_id ?? null;
}
