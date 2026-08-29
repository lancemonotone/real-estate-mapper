import type { APIRoute } from 'astro';
import {
  evaluateOneOffProximity,
  type OneOffCriterionInput,
} from '../../../lib/proximity/compute-core';
import { PLACE_TYPE_CATALOG, type PlaceTypeKey } from '../../../lib/proximity/place-types';
import type { TravelMode } from '../../../lib/types/database';
import {
  assertNestEntitlement,
  entitlementDenialResponse,
  ENTITLEMENT_ERROR_CODE,
  isListingVisible,
  isLocaleVisible,
  PLAN_MESSAGES,
} from '../../../lib/nest/entitlements';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
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

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) {
    return new Response(JSON.stringify({ error: 'Locale not found' }), { status: 404 });
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, locale_id')
    .eq('id', listingId)
    .single();
  if (listingError || !listing) {
    return new Response(JSON.stringify({ error: 'Listing not found' }), { status: 404 });
  }
  if (listing.locale_id !== localeId) {
    return new Response(
      JSON.stringify({ error: 'Listing not in this Locale' }),
      { status: 400 },
    );
  }

  const entitlement = await assertNestEntitlement(
    supabase,
    locale.nest_id,
    'proximity_compute',
    { userId: user.id },
  );
  if ('denial' in entitlement) {
    return entitlementDenialResponse(entitlement.denial);
  }
  if (!isLocaleVisible(entitlement, localeId)) {
    return entitlementDenialResponse({
      ok: false,
      code: ENTITLEMENT_ERROR_CODE,
      message: PLAN_MESSAGES.localeHidden,
    });
  }
  if (!isListingVisible(entitlement, listingId)) {
    return entitlementDenialResponse({
      ok: false,
      code: ENTITLEMENT_ERROR_CODE,
      message: PLAN_MESSAGES.listingHidden,
    });
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
  } else if (kind === 'text_query') {
    const textQuery =
      typeof body.text_query === 'string' ? body.text_query.trim() : '';
    if (!textQuery) {
      return new Response(JSON.stringify({ error: 'text_query required' }), {
        status: 400,
      });
    }
    input = {
      kind: 'text_query',
      text_query: textQuery,
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
      JSON.stringify({
        error: 'kind must be place_type, fixed_pin, or text_query',
      }),
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
