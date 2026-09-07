-- Leg into a custom end endpoint (last listing → E). Listing stops store incoming legs only.
alter table public.tour_days
  add column if not exists end_leg_duration_sec integer,
  add column if not exists end_leg_distance_m integer;
