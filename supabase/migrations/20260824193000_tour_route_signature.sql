-- Fingerprint of listing ids (visit order) the encoded_polyline was built for.
-- Null / mismatch means the map must not trust the stored polyline.
alter table public.tour_days
  add column if not exists route_signature text;
