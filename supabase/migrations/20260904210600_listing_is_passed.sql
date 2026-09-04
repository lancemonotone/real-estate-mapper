-- Evaluated-but-not-liked listings. Kept so imports do not recreate them as new.
-- Mutually exclusive with is_favorite in application code.

alter table public.listings
  add column if not exists is_passed boolean not null default false;

comment on column public.listings.is_passed is
  'True when the listing was evaluated and rejected; exclusive with is_favorite';
