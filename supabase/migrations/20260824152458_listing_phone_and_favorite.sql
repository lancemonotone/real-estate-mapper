-- Listing contact phone + nest-shared favorite flag
alter table public.listings
  add column if not exists phone text,
  add column if not exists is_favorite boolean not null default false;
