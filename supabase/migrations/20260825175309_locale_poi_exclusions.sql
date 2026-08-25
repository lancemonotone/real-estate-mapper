create table public.locale_poi_exclusions (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.locales (id) on delete cascade,
  place_type_key text not null,
  place_id text not null,
  created_at timestamptz not null default now(),
  unique (locale_id, place_type_key, place_id)
);

create index locale_poi_exclusions_locale_type_idx
  on public.locale_poi_exclusions (locale_id, place_type_key);

alter table public.locale_poi_exclusions enable row level security;

create policy "locale_poi_exclusions_all_member"
  on public.locale_poi_exclusions for all
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
