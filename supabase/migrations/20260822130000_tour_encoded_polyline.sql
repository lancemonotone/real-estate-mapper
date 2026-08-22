-- Persist Google Routes encoded polyline for tour maps
alter table public.tour_days
  add column if not exists encoded_polyline text;
