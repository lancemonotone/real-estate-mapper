-- Nest Hunt Pass billing fields + listing archive for cap counting

alter table public.nests
  add column pass_started_at timestamptz,
  add column pass_expires_at timestamptz,
  add column proximity_demo_used_at timestamptz,
  add column proximity_refresh_granted integer not null default 0,
  add column proximity_refresh_used integer not null default 0;

alter table public.listings
  add column archived_at timestamptz;

comment on column public.nests.pass_started_at is 'Hunt Pass window start (Pro features).';
comment on column public.nests.pass_expires_at is 'Hunt Pass expiry; Pro while expires_at > now().';
comment on column public.nests.proximity_demo_used_at is 'One free proximity demo per Nest when set.';
comment on column public.nests.proximity_refresh_granted is 'Proximity refresh budget granted for current/ stacked Pass windows.';
comment on column public.nests.proximity_refresh_used is 'Proximity refreshes consumed against proximity_refresh_granted.';
comment on column public.listings.archived_at is 'Archived listings excluded from active listing caps.';
