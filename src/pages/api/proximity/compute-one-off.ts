import type { APIRoute } from 'astro';
import {
  evaluateOneOffProximity,
  type OneOffCriterionInput,
} from '../../../lib/proximity/compute-core';
import { PLACE_TYPE_CATALOG, type PlaceTypeKey } from '../../../lib/proximity/place-types';
import type { TravelMode } from '../../../lib/types/database';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

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

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const listingId =
    typeof body.listing_id === 'string' ? body.listing_id.trim() : '';
  const localeId =
    typeof body.locale_id === 'string' ? body.locale_id.trim() : '';
  const kind = body.kind;
  const travelMode =
    typeof body.travel_mode === 'string' ? body.travel_mode : '';

  if (!listingId || !localeId) {
    return new Response(
      JSON.stringify({ error: 'listing_id and locale_id required' }),
      { status: 400 },
    );
  }
  if (!isTravelMode(travelMode)) {
    return new Response(
      JSON.stringify({ error: 'travel_mode must be DRIVE, WALK, BICYCLE, or TRANSIT' }),
      { status: 400 },
    );
  }

  let input: OneOffCriterionInput;
  if (kind === 'place_type') {
    const key =
      typeof body.place_type_key === 'string' ? body.place_type_key.trim() : '';
    if (!key || !isPlaceTypeKey(key)) {
      return new Response(
        JSON.stringify({ error: 'place_type_key required and must be a Google Table A type' }),
        { status: 400 },
      );
    }
    input = {
      kind: 'place_type',
      place_type_key: key,
      travel_mode: travelMode,
      locale_id: localeId,
    };
  } else if (kind === 'fixed_pin') {
    if (typeof body.pin_lat !== 'number' || typeof body.pin_lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'pin_lat and pin_lng required for fixed_pin' }),
        { status: 400 },
      );
    }
    input = {
      kind: 'fixed_pin',
      pin_lat: body.pin_lat,
      pin_lng: body.pin_lng,
      pin_name: typeof body.pin_name === 'string' ? body.pin_name : null,
      pin_place_id: typeof body.pin_place_id === 'string' ? body.pin_place_id : null,
      travel_mode: travelMode,
      locale_id: localeId,
    };
  } else {
    return new Response(
      JSON.stringify({ error: 'kind must be place_type or fixed_pin' }),
      { status: 400 },
    );
  }

  try {
    const result = await evaluateOneOffProximity(supabase, listingId, input);
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Compute failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
