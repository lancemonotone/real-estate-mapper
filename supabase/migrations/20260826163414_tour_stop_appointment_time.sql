alter table public.tour_stops
  add column appointment_time time;

comment on column public.tour_stops.appointment_time is
  'Confirmed local appointment clock time for tour_days.tour_date; null = date only';
