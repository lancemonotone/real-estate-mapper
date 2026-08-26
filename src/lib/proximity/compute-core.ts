import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRouteMatrix, type TravelMode } from '../google/route-matrix';
import type {
  Database,
  Locale,
  ProximityCriterion,
  ProximityResultStatus,
} from '../types/database';
import {
  loadExcludedPlaceIds,
  withoutExcludedPois,
} from './exclusions';
import { fillLocalePoisForTextQuery, fillLocalePoisForType } from './fill-pois';
import { googleMapsDirectionsUrl } from './maps-url';
import { pickWinnerByDuration, rankByDuration } from './pick-winner';
import {
  PROXIMITY_CHOICE_N,
  PROXIMITY_SHORTLIST_N,
  isPlaceTypeKey,
  type PlaceTypeKey,
  type PoiCandidate,
} from './place-types';
import { shortlistPois } from './shortlist';
import { normalizeTextQuery, textQueryCacheKey } from './text-query';

type Client = SupabaseClient<Database>;

/** Outcome shape shared by persisted rows and one-off (no DB id). */
export type ProximityCandidateOption = {
  place_id: string;
  place_name: string;
  place_lat: number;
  place_lng: number;
  duration_sec: number;
  distance_m: number;
};

export type ProximityOutcome = {
  status: ProximityResultStatus;
  place_id: string | null;
  place_name: string | null;
  place_lat: number | null;
  place_lng: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  maps_url: string | null;
  error_message: string | null;
  /** Top travel-time options for place_type (user may pick). */
  candidates?: ProximityCandidateOption[];
};

export type OneOffCriterionInput =
  | {
      kind: 'place_type';
      place_type_key: PlaceTypeKey;
      travel_mode: TravelMode;
      locale_id: string;
    }
  | {
      kind: 'fixed_pin';
      pin_lat: number;
      pin_lng: number;
      pin_name?: string | null;
      pin_place_id?: string | null;
      travel_mode: TravelMode;
      locale_id: string;
    }
  | {
      kind: 'text_query';
      text_query: string;
      travel_mode: TravelMode;
      locale_id: string;
    };

function isTravelMode(mode: string): mode is TravelMode {
  return (
    mode === 'DRIVE' ||
    mode === 'WALK' ||
    mode === 'BICYCLE' ||
    mode === 'TRANSIT'
  );
}

function outcome(
  partial: Partial<ProximityOutcome> & { status: ProximityResultStatus },
): ProximityOutcome {
  return {
    status: partial.status,
    place_id: partial.place_id ?? null,
    place_name: partial.place_name ?? null,
    place_lat: partial.place_lat ?? null,
    place_lng: partial.place_lng ?? null,
    duration_sec: partial.duration_sec ?? null,
    distance_m: partial.distance_m ?? null,
    maps_url: partial.maps_url ?? null,
    error_message: partial.error_message ?? null,
    candidates: partial.candidates,
  };
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

async function evaluateFixedPin(
  criterion: {
    pin_lat: number | null;
    pin_lng: number | null;
    pin_place_id: string | null;
    pin_name: string | null;
    travel_mode: string;
  },
  origin: { lat: number; lng: number },
): Promise<ProximityOutcome> {
  if (criterion.pin_lat == null || criterion.pin_lng == null) {
    return outcome({
      status: 'error',
      error_message: 'Fixed pin criterion missing coordinates',
    });
  }

  if (!isTravelMode(criterion.travel_mode)) {
    return outcome({
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
      return outcome({
        status: 'error',
        error_message: 'No route to fixed pin',
      });
    }

    const maps_url = googleMapsDirectionsUrl({
      origin,
      destination: {
        lat: criterion.pin_lat,
        lng: criterion.pin_lng,
        placeId: criterion.pin_place_id,
        name: criterion.pin_name,
      },
      travelMode: criterion.travel_mode,
    });

    return outcome({
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
    return outcome({ status: 'error', error_message: message });
  }
}

async function evaluateNearestCached(
  supabase: Client,
  locale: Locale,
  input: {
    cacheKey: string;
    travel_mode: string;
    ensureFilled: () => Promise<void>;
  },
  origin: { lat: number; lng: number },
): Promise<ProximityOutcome> {
  if (!isTravelMode(input.travel_mode)) {
    return outcome({
      status: 'error',
      error_message: `Invalid travel mode: ${input.travel_mode}`,
    });
  }

  let pois = await loadLocalePois(supabase, locale.id, input.cacheKey);
  if (pois.length === 0) {
    try {
      await input.ensureFilled();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Places fill failed';
      return outcome({ status: 'error', error_message: message });
    }
    pois = await loadLocalePois(supabase, locale.id, input.cacheKey);
  }

  const excludedIds = await loadExcludedPlaceIds(
    supabase,
    locale.id,
    input.cacheKey,
  );
  pois = withoutExcludedPois(pois, excludedIds);

  if (pois.length === 0) {
    return outcome({ status: 'no_place' });
  }

  const shortlist = shortlistPois(origin, pois, PROXIMITY_SHORTLIST_N);
  if (shortlist.length === 0) {
    return outcome({ status: 'no_place' });
  }

  try {
    const legs = await computeRouteMatrix({
      origin,
      destinations: shortlist.map((p) => ({ lat: p.lat, lng: p.lng })),
      travelMode: input.travel_mode,
    });
    const ranked = rankByDuration(shortlist, legs, PROXIMITY_CHOICE_N);
    const winner = ranked[0] ?? pickWinnerByDuration(shortlist, legs);
    if (!winner) {
      return outcome({
        status: 'error',
        error_message: 'No route among shortlisted places',
      });
    }

    const candidates = ranked.map((r) => ({
      place_id: r.poi.placeId,
      place_name: r.poi.name,
      place_lat: r.poi.lat,
      place_lng: r.poi.lng,
      duration_sec: Math.round(r.durationSec),
      distance_m: Math.round(r.distanceM),
    }));

    return outcome({
      status: 'ok',
      place_id: winner.poi.placeId,
      place_name: winner.poi.name,
      place_lat: winner.poi.lat,
      place_lng: winner.poi.lng,
      duration_sec: Math.round(winner.durationSec),
      distance_m: Math.round(winner.distanceM),
      maps_url: googleMapsDirectionsUrl({
        origin,
        destination: {
          lat: winner.poi.lat,
          lng: winner.poi.lng,
          placeId: winner.poi.placeId,
          name: winner.poi.name,
        },
        travelMode: input.travel_mode,
      }),
      candidates,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Route matrix failed';
    return outcome({ status: 'error', error_message: message });
  }
}

async function evaluatePlaceType(
  supabase: Client,
  locale: Locale,
  criterion: { place_type_key: string | null; travel_mode: string },
  origin: { lat: number; lng: number },
): Promise<ProximityOutcome> {
  const key = criterion.place_type_key;
  if (!key || !isPlaceTypeKey(key)) {
    return outcome({
      status: 'error',
      error_message: key
        ? `Unknown place type key: ${key}`
        : 'place_type criterion missing place_type_key',
    });
  }

  return evaluateNearestCached(
    supabase,
    locale,
    {
      cacheKey: key,
      travel_mode: criterion.travel_mode,
      ensureFilled: () => fillLocalePoisForType(supabase, locale, key),
    },
    origin,
  );
}

async function evaluateTextQuery(
  supabase: Client,
  locale: Locale,
  criterion: { text_query: string | null; travel_mode: string },
  origin: { lat: number; lng: number },
): Promise<ProximityOutcome> {
  const query = criterion.text_query
    ? normalizeTextQuery(criterion.text_query)
    : '';
  if (!query) {
    return outcome({
      status: 'error',
      error_message: 'text_query criterion missing text_query',
    });
  }

  const cacheKey = textQueryCacheKey(query);
  return evaluateNearestCached(
    supabase,
    locale,
    {
      cacheKey,
      travel_mode: criterion.travel_mode,
      ensureFilled: () => fillLocalePoisForTextQuery(supabase, locale, query),
    },
    origin,
  );
}

async function loadListingOrigin(
  supabase: Client,
  listingId: string,
): Promise<
  | { ok: true; listing: { id: string; locale_id: string; lat: number; lng: number } }
  | { ok: false; status: 'needs_geocode' }
  | never
> {
  const { data: listing, error } = await supabase
    .from('listings')
    .select('id, locale_id, lat, lng')
    .eq('id', listingId)
    .single();

  if (error || !listing) {
    throw new Error(error?.message ?? 'Listing not found');
  }

  if (listing.lat == null || listing.lng == null) {
    return { ok: false, status: 'needs_geocode' };
  }

  return {
    ok: true,
    listing: {
      id: listing.id,
      locale_id: listing.locale_id,
      lat: listing.lat,
      lng: listing.lng,
    },
  };
}

export async function evaluateCriterionProximity(
  supabase: Client,
  listingId: string,
  criterion: ProximityCriterion,
): Promise<ProximityOutcome> {
  const loaded = await loadListingOrigin(supabase, listingId);
  if (!loaded.ok) {
    return outcome({ status: 'needs_geocode' });
  }

  if (loaded.listing.locale_id !== criterion.locale_id) {
    throw new Error('Listing and criterion belong to different locales');
  }

  const { data: locale, error: localeError } = await supabase
    .from('locales')
    .select('*')
    .eq('id', loaded.listing.locale_id)
    .single();

  if (localeError || !locale) {
    throw new Error(localeError?.message ?? 'Locale not found');
  }

  const origin = { lat: loaded.listing.lat, lng: loaded.listing.lng };

  switch (criterion.kind) {
    case 'fixed_pin':
      return evaluateFixedPin(criterion, origin);
    case 'place_type':
      return evaluatePlaceType(supabase, locale, criterion, origin);
    case 'text_query':
      return evaluateTextQuery(supabase, locale, criterion, origin);
    default: {
      const _exhaustive: never = criterion.kind;
      throw new Error(`Unknown criterion kind: ${String(_exhaustive)}`);
    }
  }
}

export async function evaluateOneOffProximity(
  supabase: Client,
  listingId: string,
  input: OneOffCriterionInput,
): Promise<ProximityOutcome> {
  const loaded = await loadListingOrigin(supabase, listingId);
  if (!loaded.ok) {
    return outcome({ status: 'needs_geocode' });
  }

  if (loaded.listing.locale_id !== input.locale_id) {
    throw new Error('Listing does not belong to that locale');
  }

  const { data: locale, error: localeError } = await supabase
    .from('locales')
    .select('*')
    .eq('id', input.locale_id)
    .single();

  if (localeError || !locale) {
    throw new Error(localeError?.message ?? 'Locale not found');
  }

  const origin = { lat: loaded.listing.lat, lng: loaded.listing.lng };

  switch (input.kind) {
    case 'fixed_pin':
      return evaluateFixedPin(
        {
          pin_lat: input.pin_lat,
          pin_lng: input.pin_lng,
          pin_place_id: input.pin_place_id ?? null,
          pin_name: input.pin_name ?? null,
          travel_mode: input.travel_mode,
        },
        origin,
      );
    case 'place_type':
      return evaluatePlaceType(
        supabase,
        locale,
        {
          place_type_key: input.place_type_key,
          travel_mode: input.travel_mode,
        },
        origin,
      );
    case 'text_query':
      return evaluateTextQuery(
        supabase,
        locale,
        {
          text_query: input.text_query,
          travel_mode: input.travel_mode,
        },
        origin,
      );
    default: {
      const _exhaustive: never = input;
      throw new Error(`Unknown one-off kind: ${String(_exhaustive)}`);
    }
  }
}
