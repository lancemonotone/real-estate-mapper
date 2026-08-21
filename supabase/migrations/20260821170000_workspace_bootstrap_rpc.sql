-- Fix: workspace bootstrap blocked by RLS on INSERT...RETURNING
-- Run in Supabase SQL Editor

create or replace function public.create_household_workspace(p_invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.workspaces (name, invite_token_hash)
  values ('Household', p_invite_token_hash)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  return ws_id;
end;
$$;

grant execute on function public.create_household_workspace(text) to authenticated;

-- Ensure insert policy exists (safe if already present)
drop policy if exists "workspaces_insert_authenticated" on public.workspaces;
create policy "workspaces_insert_authenticated"
  on public.workspaces for insert
  to authenticated
  with check (true);

-- Allow users to read their own membership rows even before other policies apply
drop policy if exists "workspace_members_select_own" on public.workspace_members;
create policy "workspace_members_select_own"
  on public.workspace_members for select
  using (auth.uid() = user_id);
