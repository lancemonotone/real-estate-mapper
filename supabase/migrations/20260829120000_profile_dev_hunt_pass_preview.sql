alter table public.profiles
  add column if not exists dev_hunt_pass_preview boolean not null default false;

comment on column public.profiles.dev_hunt_pass_preview is
  'Developer-only: when true, this user sees Hunt Pass limits and visibility. Ignored outside dev tools.';
