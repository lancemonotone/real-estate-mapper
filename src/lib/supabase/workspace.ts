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

  if (memberError) throw memberError;
  if (existing?.workspace_id) return existing.workspace_id;

  const { hash } = generateInviteToken();
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name: 'Household', invite_token_hash: hash })
    .select('id')
    .single();

  if (wsError) throw wsError;

  const { error: joinError } = await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner',
  });

  if (joinError) throw joinError;
  return workspace.id as string;
}

export async function getPrimaryWorkspaceId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.workspace_id ?? null;
}
