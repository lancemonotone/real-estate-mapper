-- Listing photo gallery URLs (PhotoSwipe)
alter table public.listings
  add column if not exists photo_urls text[] not null default '{}'::text[];

update public.listings
set photo_urls = array[photo_url]
where photo_url is not null
  and photo_url <> ''
  and cardinality(photo_urls) = 0;
