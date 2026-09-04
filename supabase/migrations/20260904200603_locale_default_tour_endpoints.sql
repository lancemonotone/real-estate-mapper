-- Locale-level default tour start/end (hotel / home base).
-- Tour days with null endpoint fields inherit these at resolve time.

alter table public.locales
  add column if not exists default_start_address text,
  add column if not exists default_start_lat double precision,
  add column if not exists default_start_lng double precision,
  add column if not exists default_start_name text,
  add column if not exists default_start_place_id text,
  add column if not exists default_end_address text,
  add column if not exists default_end_lat double precision,
  add column if not exists default_end_lng double precision,
  add column if not exists default_end_name text,
  add column if not exists default_end_place_id text;

comment on column public.locales.default_start_address is
  'Default custom tour start for days without a per-day override';
comment on column public.locales.default_end_address is
  'Default custom tour end for days without a per-day override';
