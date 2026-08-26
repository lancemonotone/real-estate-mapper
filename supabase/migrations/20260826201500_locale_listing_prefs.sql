-- Locale-level defaults for agent listing import (beds, pets, …)
alter table public.locales
  add column if not exists listing_prefs jsonb;

comment on column public.locales.listing_prefs is
  'Household import targets for agent listing import (target_beds, pets, …).';

-- Seed Dunedin locale(s) used in import sessions when unset.
update public.locales
set listing_prefs = jsonb_build_object(
  'target_beds', 2,
  'pets', jsonb_build_object('cats', 1, 'dogs', 1)
)
where lower(name) = 'dunedin'
  and listing_prefs is null;
