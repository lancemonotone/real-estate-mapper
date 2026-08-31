-- One-time application and move-in fees (nullable; never invent defaults)
alter table public.listings
  add column if not exists application_fees numeric,
  add column if not exists move_in_fees numeric;
