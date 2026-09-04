export type TourEndpointSide = {
  address: string | null;
  lat: number | null;
  lng: number | null;
  name: string | null;
  place_id: string | null;
};

export type TourDayEndpointFields = {
  start_address: string | null;
  start_lat: number | null;
  start_lng: number | null;
  start_name: string | null;
  start_place_id: string | null;
  end_address: string | null;
  end_lat: number | null;
  end_lng: number | null;
  end_name: string | null;
  end_place_id: string | null;
};

export type LocaleDefaultEndpointFields = {
  default_start_address: string | null;
  default_start_lat: number | null;
  default_start_lng: number | null;
  default_start_name: string | null;
  default_start_place_id: string | null;
  default_end_address: string | null;
  default_end_lat: number | null;
  default_end_lng: number | null;
  default_end_name: string | null;
  default_end_place_id: string | null;
};

function hasCoords(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return lat != null && lng != null;
}

/** Patch to copy missing day endpoints from Locale defaults (materialize). */
export function tourDayEndpointPatchFromLocaleDefaults(
  day: TourDayEndpointFields,
  locale: LocaleDefaultEndpointFields,
): Partial<TourDayEndpointFields> {
  const patch: Partial<TourDayEndpointFields> = {};
  if (!hasCoords(day.start_lat, day.start_lng) && hasCoords(locale.default_start_lat, locale.default_start_lng)) {
    patch.start_address = locale.default_start_address;
    patch.start_lat = locale.default_start_lat;
    patch.start_lng = locale.default_start_lng;
    patch.start_name = locale.default_start_name;
    patch.start_place_id = locale.default_start_place_id;
  }
  if (!hasCoords(day.end_lat, day.end_lng) && hasCoords(locale.default_end_lat, locale.default_end_lng)) {
    patch.end_address = locale.default_end_address;
    patch.end_lat = locale.default_end_lat;
    patch.end_lng = locale.default_end_lng;
    patch.end_name = locale.default_end_name;
    patch.end_place_id = locale.default_end_place_id;
  }
  return patch;
}

export function localeDefaultsPatchFromDayEndpoints(
  patch: Partial<TourDayEndpointFields>,
  sides: { start?: boolean; end?: boolean },
): Partial<LocaleDefaultEndpointFields> {
  const out: Partial<LocaleDefaultEndpointFields> = {};
  if (sides.start) {
    if ('start_address' in patch) out.default_start_address = patch.start_address ?? null;
    if ('start_lat' in patch) out.default_start_lat = patch.start_lat ?? null;
    if ('start_lng' in patch) out.default_start_lng = patch.start_lng ?? null;
    if ('start_name' in patch) out.default_start_name = patch.start_name ?? null;
    if ('start_place_id' in patch) out.default_start_place_id = patch.start_place_id ?? null;
  }
  if (sides.end) {
    if ('end_address' in patch) out.default_end_address = patch.end_address ?? null;
    if ('end_lat' in patch) out.default_end_lat = patch.end_lat ?? null;
    if ('end_lng' in patch) out.default_end_lng = patch.end_lng ?? null;
    if ('end_name' in patch) out.default_end_name = patch.end_name ?? null;
    if ('end_place_id' in patch) out.default_end_place_id = patch.end_place_id ?? null;
  }
  return out;
}
