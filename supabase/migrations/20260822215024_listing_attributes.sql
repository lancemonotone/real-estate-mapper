-- Listing attribute fields for Attributes compare (nullable; never invent defaults)
alter table public.listings
  add column if not exists price_monthly numeric,
  add column if not exists deposit numeric,
  add column if not exists fees_monthly numeric,
  add column if not exists sqft integer,
  add column if not exists beds numeric,
  add column if not exists baths numeric,
  add column if not exists pet_rent_monthly numeric,
  add column if not exists pet_deposit numeric,
  add column if not exists amenities text[];
