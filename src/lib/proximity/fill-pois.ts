import type { SupabaseClient } from '@supabase/supabase-js';
import { searchNearbyPlaces } from '../google/places-nearby';
import { searchTextPlaces } from '../google/places-text';
import { haversineMeters } from '../geo/haversine';
import type { Database, Locale } from '../types/database';
import {
  PLACE_TYPE_CATALOG,
  type PlaceTypeKey,
  type PoiCandidate,
} from './place-types';

type Client = SupabaseClient<Database>;

/** Places Nearby/Text circle radius cap (Google). */
export const PLACES_MAX_RADIUS_M = 50_000;

/**
 * Centers for Places circle searches that cover a Locale disk.
 * When locale radius ≤ 50km, a single center at the Locale center.
 * When larger, a square grid with spacing chosen so 50km circles cover the disk.
 */
export function tileSearchCenters(
  center: { lat: number; lng: number },
  localeRadiusM: number,
): Array<{ lat: number; lng: number; radiusM: number }> {
  if (localeRadiusM <= PLACES_MAX_RADIUS_M) {
    return [{ lat: center.lat, lng: center.lng, radiusM: localeRadiusM }];
  }

  const tileRadiusM = PLACES_MAX_RADIUS_M;
  // Square grid: spacing ≤ r√2 covers the plane; slight shrink for float margin.
  const spacingM = tileRadiusM * Math.SQRT2 * 0.95;
  const latDegPerM = 1 / 111_320;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const lngDegPerM = 1 / (111_320 * Math.max(cosLat, 1e-6));

  const latStep = spacingM * latDegPerM;
  const lngStep = spacingM * lngDegPerM;
  const latSpan = localeRadiusM * latDegPerM;
  const lngSpan = localeRadiusM * lngDegPerM;

  const out: Array<{ lat: number; lng: number; radiusM: number }> = [];
  const seen = new Set<string>();

  for (let lat = center.lat - latSpan; lat <= center.lat + latSpan + 1e-12; lat += latStep) {
    for (let lng = center.lng - lngSpan; lng <= center.lng + lngSpan + 1e-12; lng += lngStep) {
      if (haversineMeters(center, { lat, lng }) > localeRadiusM) {
        continue;
      }
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ lat, lng, radiusM: tileRadiusM });
    }
  }

  if (out.length === 0) {
    out.push({ lat: center.lat, lng: center.lng, radiusM: tileRadiusM });
  } else if (
    !out.some(
      (c) =>
        Math.abs(c.lat - center.lat) < 1e-9 && Math.abs(c.lng - center.lng) < 1e-9,
    )
  ) {
    out.unshift({ lat: center.lat, lng: center.lng, radiusM: tileRadiusM });
  }

  return out;
}

function isPlaceTypeKey(key: string): key is PlaceTypeKey {
  return Object.prototype.hasOwnProperty.call(PLACE_TYPE_CATALOG, key);
}

async function searchAtCenter(
  placeTypeKey: PlaceTypeKey,
  center: { lat: number; lng: number; radiusM: number },
): Promise<PoiCandidate[]> {
  const strategy = PLACE_TYPE_CATALOG[placeTypeKey].strategy;
  switch (strategy.kind) {
    case 'nearby':
      return searchNearbyPlaces({
        lat: center.lat,
        lng: center.lng,
        radiusM: center.radiusM,
        includedTypes: strategy.includedTypes,
      });
    case 'text':
      return searchTextPlaces({
        lat: center.lat,
        lng: center.lng,
        radiusM: center.radiusM,
        textQuery: strategy.textQuery,
      });
    default: {
      const _exhaustive: never = strategy;
      return _exhaustive;
    }
  }
}

export async function fillLocalePoisForType(
  supabase: Client,
  locale: Locale,
  placeTypeKey: PlaceTypeKey,
): Promise<number> {
  if (!isPlaceTypeKey(placeTypeKey)) {
    throw new Error(`Unknown place type key: ${placeTypeKey}`);
  }

  const centers = tileSearchCenters(
    { lat: locale.center_lat, lng: locale.center_lng },
    locale.radius_m,
  );

  const byPlaceId = new Map<string, PoiCandidate>();
  for (const center of centers) {
    const found = await searchAtCenter(placeTypeKey, center);
    for (const poi of found) {
      if (haversineMeters(
        { lat: locale.center_lat, lng: locale.center_lng },
        poi,
      ) > locale.radius_m) {
        continue;
      }
      if (!byPlaceId.has(poi.placeId)) {
        byPlaceId.set(poi.placeId, poi);
      }
    }
  }

  const rows = [...byPlaceId.values()].map((poi) => ({
    locale_id: locale.id,
    place_type_key: placeTypeKey,
    place_id: poi.placeId,
    name: poi.name,
    lat: poi.lat,
    lng: poi.lng,
    fetched_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return 0;
  }

  const { data, error } = await supabase
    .from('locale_pois')
    .upsert(rows, { onConflict: 'locale_id,place_type_key,place_id' })
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? rows.length;
}
