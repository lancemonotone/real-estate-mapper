-- Replace one-time proximity demo flag with route search column cap (counted from proximity_criteria).

alter table public.nests drop column if exists proximity_demo_used_at;
