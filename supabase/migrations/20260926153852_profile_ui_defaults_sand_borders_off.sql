-- Product defaults: Warm sand theme, UI borders off.
alter table public.profiles
  alter column ui_show_borders set default false;

alter table public.profiles
  alter column ui_theme_id set default 'sand';

comment on column public.profiles.ui_show_borders is
  'When false, app chrome hides borders but keeps drop shadows (data-ui-borders=off). Default off.';

-- Align existing rows that still have the previous product defaults.
update public.profiles
set ui_show_borders = false
where ui_show_borders = true;

update public.profiles
set ui_theme_id = 'sand'
where ui_theme_id is null or ui_theme_id = 'sea';
