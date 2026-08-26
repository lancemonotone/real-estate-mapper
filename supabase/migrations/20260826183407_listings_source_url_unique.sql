-- One non-null source_url per locale (agent upsert key).
-- Manual listings may keep source_url null (multiple allowed).

create unique index if not exists listings_locale_source_url_uidx
  on public.listings (locale_id, source_url)
  where source_url is not null;
