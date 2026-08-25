-- Nest members may read co-member profiles (display name for member lists).
create policy "profiles_select_nest_member"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.nest_members mine
      join public.nest_members theirs on mine.nest_id = theirs.nest_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );
