-- Place name + Google place id for custom tour start/end (photo via place photo proxy)
alter table public.tour_days
  add column if not exists start_name text,
  add column if not exists start_place_id text,
  add column if not exists end_name text,
  add column if not exists end_place_id text;
