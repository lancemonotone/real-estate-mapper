alter table public.proximity_results
  add column locked boolean not null default false;

create table public.listing_places (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  travel_mode text not null check (travel_mode in ('DRIVE', 'WALK', 'BICYCLE', 'TRANSIT')),
  label text,
  duration_sec integer,
  distance_m integer,
  maps_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, place_id, travel_mode)
);

create index listing_places_listing_id_idx on public.listing_places (listing_id);

alter table public.listing_places enable row level security;

create policy "listing_places_all_member"
  on public.listing_places for all
  using (
    exists (
      select 1
      from public.listings li
      join public.locales loc on loc.id = li.locale_id
      where li.id = listing_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1
      from public.listings li
      join public.locales loc on loc.id = li.locale_id
      where li.id = listing_id and public.is_nest_member(loc.nest_id)
    )
  );
