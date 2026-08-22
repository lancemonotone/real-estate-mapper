import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRouteMatrix, type TravelMode } from '../google/route-matrix';
import type {
  Database,
  Locale,
  ProximityCriterion,
  ProximityResult,
  ProximityResultStatus,
} from '../types/database';
import { fillLocalePoisForType } from './fill-pois';
import { googleMapsCoordUrl, googleMapsPlaceUrl } from './maps-url';
import { pickWinnerByDuration } from './pick-winner';
import {
  PLACE_TYPE_CATALOG,
  PROXIMITY_SHORTLIST_N,
  type PlaceTypeKey,
  type PoiCandidate,
} from './place-types';
import { shortlistPois } from './shortlist';

type Client = SupabaseClient<Database>;

export type ProximityResultRow = ProximityResult;

type ResultUpsert = {
  listing_id: string;
  criterion_id: string;
  status: ProximityResultStatus;
  place_id?: string | null;
  place_name?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  duration_sec?: number | null;
  distance_m?: number | null;
  maps_url?: string | null;
  error_message?: string | null;
};

function isPlaceTypeKey(key: string): key is PlaceTypeKey {
  return Object.prototype.hasOwnProperty.call(PLACE_TYPE_CATALOG, key);
}

function isTravelMode(mode: string): mode is TravelMode {
  return (
    mode === 'DRIVE' ||
    mode === 'WALK' ||
    mode === 'BICYCLE' ||
    mode === 'TRANSIT'
  );
}

async function upsertResult(
  supabase: Client,
  row: ResultUpsert,
): Promise<ProximityResultRow> {
  const payload = {
    listing_id: row.listing_id,
    criterion_id: row.criterion_id,
    status: row.status,
    place_id: row.place_id ?? null,
    place_name: row.place_name ?? null,
    place_lat: row.place_lat ?? null,
    place_lng: row.place_lng ?? null,
    duration_sec: row.duration_sec ?? null,
    distance_m: row.distance_m ?? null,
    maps_url: row.maps_url ?? null,
    error_message: row.error_message ?? null,
    computed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('proximity_results')
    .upsert(payload, { onConflict: 'listing_id,criterion_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to upsert proximity_results');
  }
  return data;
}

async function loadLocalePois(
  supabase: Client,
  localeId: string,
  placeTypeKey: string,
): Promise<PoiCandidate[]> {
  const { data, error } = await supabase
    .from('locale_pois')
    .select('place_id, name, lat, lng')
    .eq('locale_id', localeId)
    .eq('place_type_key', placeTypeKey);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    placeId: row.place_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
  }));
}

async function computeFixedPin(
  supabase: Client,
  listingId: string,
  criterion: ProximityCriterion,
  origin: { lat: number; lng: number },
): Promise<ProximityResultRow> {
  if (criterion.pin_lat == null || criterion.pin_lng == null) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'error',
      error_message: 'Fixed pin criterion missing coordinates',
    });
  }

  if (!isTravelMode(criterion.travel_mode)) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'error',
      error_message: `Invalid travel mode: ${criterion.travel_mode}`,
    });
  }

  try {
    const legs = await computeRouteMatrix({
      origin,
      destinations: [{ lat: criterion.pin_lat, lng: criterion.pin_lng }],
      travelMode: criterion.travel_mode,
    });
    const leg = legs.find((l) => l.destinationIndex === 0 && l.ok);
    if (!leg) {
      return upsertResult(supabase, {
        listing_id: listingId,
        criterion_id: criterion.id,
        status: 'error',
        error_message: 'No route to fixed pin',
      });
    }

    const maps_url = criterion.pin_place_id
      ? googleMapsPlaceUrl(criterion.pin_place_id)
      : googleMapsCoordUrl(criterion.pin_lat, criterion.pin_lng);

    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'ok',
      place_id: criterion.pin_place_id,
      place_name: criterion.pin_name,
      place_lat: criterion.pin_lat,
      place_lng: criterion.pin_lng,
      duration_sec: Math.round(leg.durationSec),
      distance_m: Math.round(leg.distanceM),
      maps_url,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Route matrix failed';
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'error',
      error_message: message,
    });
  }
}

async function computePlaceType(
  supabase: Client,
  listingId: string,
  criterion: ProximityCriterion,
  locale: Locale,
  origin: { lat: number; lng: number },
): Promise<ProximityResultRow> {
  const key = criterion.place_type_key;
  if (!key || !isPlaceTypeKey(key)) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'error',
      error_message: key
        ? `Unknown place type key: ${key}`
        : 'place_type criterion missing place_type_key',
    });
  }

  if (!isTravelMode(criterion.travel_mode)) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'error',
      error_message: `Invalid travel mode: ${criterion.travel_mode}`,
    });
  }

  let pois = await loadLocalePois(supabase, locale.id, key);
  if (pois.length === 0) {
    try {
      await fillLocalePoisForType(supabase, locale, key);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Places fill failed';
      return upsertResult(supabase, {
        listing_id: listingId,
        criterion_id: criterion.id,
        status: 'error',
        error_message: message,
      });
    }
    pois = await loadLocalePois(supabase, locale.id, key);
  }

  if (pois.length === 0) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'no_place',
    });
  }

  const shortlist = shortlistPois(origin, pois, PROXIMITY_SHORTLIST_N);
  if (shortlist.length === 0) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'no_place',
    });
  }

  try {
    const legs = await computeRouteMatrix({
      origin,
      destinations: shortlist.map((p) => ({ lat: p.lat, lng: p.lng })),
      travelMode: criterion.travel_mode,
    });
    const winner = pickWinnerByDuration(shortlist, legs);
    if (!winner) {
      return upsertResult(supabase, {
        listing_id: listingId,
        criterion_id: criterion.id,
        status: 'error',
        error_message: 'No route among shortlisted places',
      });
    }

    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'ok',
      place_id: winner.poi.placeId,
      place_name: winner.poi.name,
      place_lat: winner.poi.lat,
      place_lng: winner.poi.lng,
      duration_sec: Math.round(winner.durationSec),
      distance_m: Math.round(winner.distanceM),
      maps_url: googleMapsPlaceUrl(winner.poi.placeId),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Route matrix failed';
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterion.id,
      status: 'error',
      error_message: message,
    });
  }
}

export async function computeProximityResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
): Promise<ProximityResultRow> {
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, locale_id, lat, lng')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? 'Listing not found');
  }

  const { data: criterion, error: criterionError } = await supabase
    .from('proximity_criteria')
    .select('*')
    .eq('id', criterionId)
    .single();

  if (criterionError || !criterion) {
    throw new Error(criterionError?.message ?? 'Criterion not found');
  }

  if (listing.locale_id !== criterion.locale_id) {
    throw new Error('Listing and criterion belong to different locales');
  }

  const { data: locale, error: localeError } = await supabase
    .from('locales')
    .select('*')
    .eq('id', listing.locale_id)
    .single();

  if (localeError || !locale) {
    throw new Error(localeError?.message ?? 'Locale not found');
  }

  if (listing.lat == null || listing.lng == null) {
    return upsertResult(supabase, {
      listing_id: listingId,
      criterion_id: criterionId,
      status: 'needs_geocode',
    });
  }

  const origin = { lat: listing.lat, lng: listing.lng };

  switch (criterion.kind) {
    case 'fixed_pin':
      return computeFixedPin(supabase, listingId, criterion, origin);
    case 'place_type':
      return computePlaceType(supabase, listingId, criterion, locale, origin);
    default: {
      const _exhaustive: never = criterion.kind;
      throw new Error(`Unknown criterion kind: ${String(_exhaustive)}`);
    }
  }
}

export async function computeStaleForLocale(
  supabase: Client,
  localeId: string,
): Promise<ProximityResultRow[]> {
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id, updated_at')
    .eq('locale_id', localeId);

  if (listingsError) {
    throw new Error(listingsError.message);
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('proximity_criteria')
    .select('id')
    .eq('locale_id', localeId);

  if (criteriaError) {
    throw new Error(criteriaError.message);
  }

  if (!listings?.length || !criteria?.length) {
    return [];
  }

  const listingIds = listings.map((l) => l.id);
  const { data: existing, error: resultsError } = await supabase
    .from('proximity_results')
    .select('listing_id, criterion_id, computed_at')
    .in('listing_id', listingIds);

  if (resultsError) {
    throw new Error(resultsError.message);
  }

  const resultKey = (listingId: string, criterionId: string) =>
    `${listingId}:${criterionId}`;
  const computedAtByPair = new Map<string, string>();
  for (const row of existing ?? []) {
    computedAtByPair.set(
      resultKey(row.listing_id, row.criterion_id),
      row.computed_at,
    );
  }

  const listingUpdated = new Map(
    listings.map((l) => [l.id, l.updated_at] as const),
  );

  const results: ProximityResultRow[] = [];
  for (const listing of listings) {
    for (const criterion of criteria) {
      const key = resultKey(listing.id, criterion.id);
      const computedAt = computedAtByPair.get(key);
      const updatedAt = listingUpdated.get(listing.id);
      const stale =
        computedAt == null ||
        (updatedAt != null && updatedAt > computedAt);
      if (!stale) continue;
      results.push(
        await computeProximityResult(supabase, listing.id, criterion.id),
      );
    }
  }

  return results;
}
