-- Real Estate Mapper v1 schema
-- Apply via Supabase SQL editor or: supabase db push

create extension if not exists "pgcrypto";

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Household',
  invite_token_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- Members
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

create policy "workspaces_select_member"
  on public.workspaces for select
  using (public.is_workspace_member(id));

create policy "workspaces_update_member"
  on public.workspaces for update
  using (public.is_workspace_member(id));

create policy "workspace_members_select"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_self"
  on public.workspace_members for insert
  with check (auth.uid() = user_id);

-- Listings
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text,
  address text,
  lat double precision,
  lng double precision,
  source_url text,
  photo_path text,
  photo_url text,
  appointment_at timestamptz,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_workspace_id_idx on public.listings (workspace_id);

alter table public.listings enable row level security;

create policy "listings_all_member"
  on public.listings for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Tour days
create table public.tour_days (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  tour_date date not null,
  label text,
  created_at timestamptz not null default now(),
  unique (workspace_id, tour_date)
);

create index tour_days_workspace_id_idx on public.tour_days (workspace_id);

alter table public.tour_days enable row level security;

create policy "tour_days_all_member"
  on public.tour_days for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Tour stops
create table public.tour_stops (
  id uuid primary key default gen_random_uuid(),
  tour_day_id uuid not null references public.tour_days (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  is_start boolean not null default false,
  sort_order integer,
  leg_duration_sec integer,
  leg_distance_m integer,
  unique (tour_day_id, listing_id)
);

create index tour_stops_tour_day_id_idx on public.tour_stops (tour_day_id);

alter table public.tour_stops enable row level security;

create policy "tour_stops_all_member"
  on public.tour_stops for all
  using (
    exists (
      select 1
      from public.tour_days td
      where td.id = tour_day_id
        and public.is_workspace_member(td.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.tour_days td
      where td.id = tour_day_id
        and public.is_workspace_member(td.workspace_id)
    )
  );

-- Storage bucket for listing photos
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "listing_photos_select"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "listing_photos_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'listing-photos');

create policy "listing_photos_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'listing-photos');

create policy "listing_photos_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos');

-- Bootstrap profile on signup (workspace created in app ensureWorkspaceForUser)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
