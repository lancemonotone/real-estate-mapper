-- Nearest search phrase criteria (free-form Text Search, not Table A types).

alter table public.proximity_criteria
  add column if not exists text_query text;

alter table public.proximity_criteria
  drop constraint if exists proximity_criteria_kind_check;

alter table public.proximity_criteria
  add constraint proximity_criteria_kind_check
  check (kind in ('place_type', 'fixed_pin', 'text_query'));

alter table public.proximity_criteria
  drop constraint if exists proximity_criteria_type_fields;

alter table public.proximity_criteria
  add constraint proximity_criteria_type_fields check (
    (
      kind = 'place_type'
      and place_type_key is not null
      and text_query is null
    )
    or (
      kind = 'fixed_pin'
      and pin_lat is not null
      and pin_lng is not null
      and text_query is null
    )
    or (
      kind = 'text_query'
      and text_query is not null
      and place_type_key is null
      and pin_lat is null
      and pin_lng is null
    )
  );
