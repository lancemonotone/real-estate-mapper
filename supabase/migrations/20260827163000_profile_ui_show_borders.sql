-- Profile preference: show UI borders (default on). When false, ui-borders-off.css applies.
alter table public.profiles
  add column if not exists ui_show_borders boolean not null default true;

comment on column public.profiles.ui_show_borders is
  'When false, app chrome hides borders but keeps drop shadows (data-ui-borders=off).';
