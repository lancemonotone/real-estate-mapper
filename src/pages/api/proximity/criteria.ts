import type { APIRoute } from 'astro';
import {
  fillLocalePoisForTextQuery,
  fillLocalePoisForType,
} from '../../../lib/proximity/fill-pois';
import { PLACE_TYPE_CATALOG, type PlaceTypeKey } from '../../../lib/proximity/place-types';
import { normalizeTextQuery } from '../../../lib/proximity/text-query';
import type { ProximityCriterionKind, TravelMode } from '../../../lib/types/database';
import {
  assertNestEntitlement,
  entitlementDenialResponse,
} from '../../../lib/nest/entitlements';
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

function isCriterionKind(kind: string): kind is ProximityCriterionKind {
  return kind === 'place_type' || kind === 'fixed_pin' || kind === 'text_query';
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

  let body: {
    locale_id?: string;
    label?: string;
    kind?: string;
    place_type_key?: string;
    text_query?: string;
    pin_lat?: number;
    pin_lng?: number;
    pin_place_id?: string | null;
    pin_name?: string | null;
    travel_mode?: string;
    sort_order?: number;
    find_or_create?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const localeId = body.locale_id?.trim();
  const label = body.label?.trim();
  const kind = body.kind;
  const travelMode = body.travel_mode;
  const findOrCreate = body.find_or_create === true;

  if (!localeId) {
    return new Response(JSON.stringify({ error: 'locale_id required' }), { status: 400 });
  }

  const { data: localeRow, error: localeLookupError } = await supabase
    .from('locales')
    .select('nest_id')
    .eq('id', localeId)
    .single();
  if (localeLookupError || !localeRow) {
    return new Response(JSON.stringify({ error: 'Locale not found' }), { status: 404 });
  }

  if (!label && !findOrCreate) {
    return new Response(JSON.stringify({ error: 'label required' }), { status: 400 });
  }
  if (!kind || !isCriterionKind(kind)) {
    return new Response(
      JSON.stringify({
        error: 'kind must be place_type, fixed_pin, or text_query',
      }),
      { status: 400 },
    );
  }
  if (!travelMode || !isTravelMode(travelMode)) {
    return new Response(
      JSON.stringify({ error: 'travel_mode must be DRIVE, WALK, BICYCLE, or TRANSIT' }),
      { status: 400 },
    );
  }

  let place_type_key: string | null = null;
  let text_query: string | null = null;
  let pin_lat: number | null = null;
  let pin_lng: number | null = null;
  let pin_place_id: string | null = body.pin_place_id?.trim() || null;
  let pin_name: string | null = body.pin_name?.trim() || null;

  if (kind === 'place_type') {
    const key = body.place_type_key?.trim();
    if (!key || !isPlaceTypeKey(key)) {
      return new Response(
        JSON.stringify({ error: 'place_type_key required and must be a Google Table A type' }),
        { status: 400 },
      );
    }
    place_type_key = key;
  } else if (kind === 'text_query') {
    const query = normalizeTextQuery(body.text_query ?? '');
    if (!query) {
      return new Response(JSON.stringify({ error: 'text_query required' }), {
        status: 400,
      });
    }
    text_query = query;
  } else {
    if (typeof body.pin_lat !== 'number' || typeof body.pin_lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'pin_lat and pin_lng required for fixed_pin' }),
        { status: 400 },
      );
    }
    pin_lat = body.pin_lat;
    pin_lng = body.pin_lng;
  }

  if (findOrCreate) {
    let existingQuery = supabase
      .from('proximity_criteria')
      .select('*')
      .eq('locale_id', localeId)
      .eq('travel_mode', travelMode)
      .eq('kind', kind);

    if (kind === 'place_type') {
      existingQuery = existingQuery.eq('place_type_key', place_type_key!);
    } else if (kind === 'text_query') {
      existingQuery = existingQuery.eq('text_query', text_query!);
    } else {
      if (!pin_place_id) {
        return new Response(
          JSON.stringify({ error: 'pin_place_id required for find_or_create shared place' }),
          { status: 400 },
        );
      }
      existingQuery = existingQuery.eq('pin_place_id', pin_place_id);
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), {
        status: 500,
      });
    }
    if (existing) {
      return new Response(JSON.stringify({ criterion: existing, reused: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const entitlement = await assertNestEntitlement(
    supabase,
    localeRow.nest_id,
    'add_route_search_column',
    { localeId },
  );
  if ('denial' in entitlement) {
    return entitlementDenialResponse(entitlement.denial);
  }

  const resolvedLabel =
    label ||
    (kind === 'place_type' && place_type_key
      ? PLACE_TYPE_CATALOG[place_type_key as PlaceTypeKey].label
      : kind === 'text_query'
        ? text_query
        : pin_name) ||
    'Travel column';

  const sort_order =
    typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)
      ? body.sort_order
      : 0;

  const { data: criterion, error: insertError } = await supabase
    .from('proximity_criteria')
    .insert({
      locale_id: localeId,
      label: resolvedLabel,
      kind,
      place_type_key,
      text_query,
      pin_lat,
      pin_lng,
      pin_place_id,
      pin_name,
      travel_mode: travelMode,
      sort_order,
    })
    .select('*')
    .single();

  if (insertError || !criterion) {
    return new Response(
      JSON.stringify({ error: insertError?.message ?? 'Failed to create criterion' }),
      { status: 500 },
    );
  }

  if (kind === 'place_type' && place_type_key) {
    const { data: locale, error: localeError } = await supabase
      .from('locales')
      .select('*')
      .eq('id', localeId)
      .single();

    if (localeError || !locale) {
      return new Response(
        JSON.stringify({
          error: localeError?.message ?? 'Locale not found',
          id: criterion.id,
        }),
        { status: 500 },
      );
    }

    try {
      const poiCount = await fillLocalePoisForType(
        supabase,
        locale,
        place_type_key as PlaceTypeKey,
      );
      return new Response(
        JSON.stringify({ criterion, poi_upsert_count: poiCount, reused: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Places fill failed';
      return new Response(
        JSON.stringify({ error: message, id: criterion.id }),
        { status: 500 },
      );
    }
  }

  if (kind === 'text_query' && text_query) {
    const { data: locale, error: localeError } = await supabase
      .from('locales')
      .select('*')
      .eq('id', localeId)
      .single();

    if (localeError || !locale) {
      return new Response(
        JSON.stringify({
          error: localeError?.message ?? 'Locale not found',
          id: criterion.id,
        }),
        { status: 500 },
      );
    }

    try {
      const poiCount = await fillLocalePoisForTextQuery(supabase, locale, text_query);
      return new Response(
        JSON.stringify({ criterion, poi_upsert_count: poiCount, reused: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Places fill failed';
      return new Response(
        JSON.stringify({ error: message, id: criterion.id }),
        { status: 500 },
      );
    }
  }

  return new Response(JSON.stringify({ criterion, reused: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request, cookies, locals, url }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'id query required' }), { status: 400 });
  }

  const { error } = await supabase.from('proximity_criteria').delete().eq('id', id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
