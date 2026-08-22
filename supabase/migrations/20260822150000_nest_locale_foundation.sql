-- Wayhome: workspaces → nests; add locales; scope listings & tour_days

-- 1) Membership helper (reads workspace_members until rename)
create or replace function public.is_nest_member(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = n
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_nest_member(ws);
$$;

-- 2) Locales
create table public.locales (
  id uuid primary key default gen_random_uuid(),
  nest_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m double precision not null check (radius_m > 0),
  center_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locales_nest_id_idx on public.locales (nest_id);

alter table public.locales enable row level security;

create policy "locales_all_member"
  on public.locales for all
  using (public.is_nest_member(nest_id))
  with check (public.is_nest_member(nest_id));

-- 3) Backfill one Locale per workspace
insert into public.locales (nest_id, name, center_lat, center_lng, radius_m)
select
  w.id,
  coalesce(nullif(trim(w.name), ''), 'Household') || ' Locale',
  coalesce((
    select avg(l.lat) from public.listings l
    where l.workspace_id = w.id and l.lat is not null and l.lng is not null
  ), 0),
  coalesce((
    select avg(l.lng) from public.listings l
    where l.workspace_id = w.id and l.lat is not null and l.lng is not null
  ), 0),
  25000
from public.workspaces w;

-- 4) listings.locale_id
alter table public.listings
  add column locale_id uuid references public.locales (id) on delete cascade;

update public.listings li
set locale_id = loc.id
from public.locales loc
where loc.nest_id = li.workspace_id;

alter table public.listings
  alter column locale_id set not null;

drop policy if exists "listings_all_member" on public.listings;
alter table public.listings drop constraint listings_workspace_id_fkey;
drop index if exists listings_workspace_id_idx;
alter table public.listings drop column workspace_id;
create index listings_locale_id_idx on public.listings (locale_id);

create policy "listings_all_member"
  on public.listings for all
  using (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  );

-- 5) tour_days.locale_id
alter table public.tour_days
  add column locale_id uuid references public.locales (id) on delete cascade;

update public.tour_days td
set locale_id = loc.id
from public.locales loc
where loc.nest_id = td.workspace_id;

alter table public.tour_days alter column locale_id set not null;

drop policy if exists "tour_days_all_member" on public.tour_days;
drop policy if exists "tour_stops_all_member" on public.tour_stops;
alter table public.tour_days drop constraint tour_days_workspace_id_tour_date_key;
alter table public.tour_days drop constraint tour_days_workspace_id_fkey;
drop index if exists tour_days_workspace_id_idx;
alter table public.tour_days drop column workspace_id;
create unique index tour_days_locale_id_tour_date_key on public.tour_days (locale_id, tour_date);
create index tour_days_locale_id_idx on public.tour_days (locale_id);

create policy "tour_days_all_member"
  on public.tour_days for all
  using (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  );

create policy "tour_stops_all_member"
  on public.tour_stops for all
  using (
    exists (
      select 1
      from public.tour_days td
      join public.locales loc on loc.id = td.locale_id
      where td.id = tour_day_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1
      from public.tour_days td
      join public.locales loc on loc.id = td.locale_id
      where td.id = tour_day_id and public.is_nest_member(loc.nest_id)
    )
  );

-- 6) Rename workspaces → nests, workspace_members → nest_members
alter table public.workspace_members rename column workspace_id to nest_id;
alter table public.workspace_members rename to nest_members;
alter table public.workspaces rename to nests;

alter table public.locales drop constraint locales_nest_id_fkey;
alter table public.locales
  add constraint locales_nest_id_fkey
  foreign key (nest_id) references public.nests (id) on delete cascade;

-- Drop policies that still reference is_workspace_member before dropping it
drop policy if exists "workspaces_select_member" on public.nests;
drop policy if exists "workspaces_insert_authenticated" on public.nests;
drop policy if exists "workspaces_update_member" on public.nests;
drop policy if exists "workspace_members_select" on public.nest_members;
drop policy if exists "workspace_members_select_own" on public.nest_members;
drop policy if exists "workspace_members_insert_self" on public.nest_members;

create or replace function public.is_nest_member(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nest_members m
    where m.nest_id = n and m.user_id = auth.uid()
  );
$$;

drop function if exists public.is_workspace_member(uuid);

create or replace function public.nest_id_for_invite(token_hash text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.nests where invite_token_hash = token_hash limit 1;
$$;

drop function if exists public.workspace_id_for_invite(text);
grant execute on function public.nest_id_for_invite(text) to authenticated;

create policy "nests_select_member"
  on public.nests for select using (public.is_nest_member(id));
create policy "nests_insert_authenticated"
  on public.nests for insert to authenticated with check (true);
create policy "nests_update_member"
  on public.nests for update using (public.is_nest_member(id));

create policy "nest_members_select"
  on public.nest_members for select using (public.is_nest_member(nest_id));
create policy "nest_members_select_own"
  on public.nest_members for select using (auth.uid() = user_id);
create policy "nest_members_insert_self"
  on public.nest_members for insert with check (auth.uid() = user_id);

-- 7) Bootstrap RPC (no default Locale — user creates with real center)
drop function if exists public.create_household_workspace(text);

create or replace function public.create_household_nest(p_invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nest uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.nests (name, invite_token_hash)
  values ('Nest', p_invite_token_hash)
  returning id into nest;

  insert into public.nest_members (nest_id, user_id, role)
  values (nest, uid, 'owner');

  return nest;
end;
$$;

grant execute on function public.create_household_nest(text) to authenticated;
