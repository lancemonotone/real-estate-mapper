-- Remap legacy v1 catalog aliases to Google Table A type ids.
update public.proximity_criteria
set place_type_key = 'grocery_store'
where place_type_key = 'grocery';

update public.proximity_criteria
set place_type_key = 'transit_station'
where place_type_key = 'transit';

update public.locale_pois
set place_type_key = 'grocery_store'
where place_type_key = 'grocery';

update public.locale_pois
set place_type_key = 'transit_station'
where place_type_key = 'transit';

update public.locale_poi_exclusions
set place_type_key = 'grocery_store'
where place_type_key = 'grocery';

update public.locale_poi_exclusions
set place_type_key = 'transit_station'
where place_type_key = 'transit';
