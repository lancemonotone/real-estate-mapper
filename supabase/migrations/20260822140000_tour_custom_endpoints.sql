-- Optional non-listing start/end for a tour day
alter table public.tour_days
  add column if not exists start_address text,
  add column if not exists start_lat double precision,
  add column if not exists start_lng double precision,
  add column if not exists end_address text,
  add column if not exists end_lat double precision,
  add column if not exists end_lng double precision;
