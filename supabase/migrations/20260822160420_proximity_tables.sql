create table public.proximity_criteria (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.locales (id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('place_type', 'fixed_pin')),
  place_type_key text,
  pin_lat double precision,
  pin_lng double precision,
  pin_place_id text,
  pin_name text,
  travel_mode text not null check (travel_mode in ('DRIVE', 'WALK', 'BICYCLE', 'TRANSIT')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint proximity_criteria_type_fields check (
    (kind = 'place_type' and place_type_key is not null)
    or
    (kind = 'fixed_pin' and pin_lat is not null and pin_lng is not null)
  )
);

create index proximity_criteria_locale_id_idx on public.proximity_criteria (locale_id);

alter table public.proximity_criteria enable row level security;

create policy "proximity_criteria_all_member"
  on public.proximity_criteria for all
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

create table public.locale_pois (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.locales (id) on delete cascade,
  place_type_key text not null,
  place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  fetched_at timestamptz not null default now(),
  unique (locale_id, place_type_key, place_id)
);

create index locale_pois_locale_type_idx
  on public.locale_pois (locale_id, place_type_key);

alter table public.locale_pois enable row level security;

create policy "locale_pois_all_member"
  on public.locale_pois for all
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

create table public.proximity_results (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  criterion_id uuid not null references public.proximity_criteria (id) on delete cascade,
  status text not null check (status in ('ok', 'needs_geocode', 'no_place', 'error')),
  place_id text,
  place_name text,
  place_lat double precision,
  place_lng double precision,
  duration_sec integer,
  distance_m integer,
  maps_url text,
  error_message text,
  computed_at timestamptz not null default now(),
  unique (listing_id, criterion_id)
);

create index proximity_results_criterion_id_idx on public.proximity_results (criterion_id);

alter table public.proximity_results enable row level security;

create policy "proximity_results_all_member"
  on public.proximity_results for all
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
