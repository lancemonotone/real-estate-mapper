import type { APIRoute } from 'astro';
import {
  DEFAULT_LOCALE_RADIUS_MILES,
  isAllowedRadiusMiles,
  milesToMeters,
} from '../../../lib/geo/locale-radius';
import { geocodeAddress } from '../../../lib/google/geocode';
import { parseListingPrefsInput } from '../../../lib/listings/listing-prefs';
import {
  assertNestEntitlement,
  entitlementDenialResponse,
} from '../../../lib/nest/entitlements';
import { ensureNestForUser, getPrimaryNestId } from '../../../lib/supabase/nest';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    place?: string;
    radius_miles?: number;
    center_label?: string | null;
    listing_prefs?: {
      target_beds?: unknown;
      pets?: { cats?: unknown; dogs?: unknown };
    };
  };

  if (!body.name?.trim()) {
    return new Response(JSON.stringify({ error: 'Name required' }), { status: 400 });
  }

  const place = body.place?.trim() ?? '';
  if (!place) {
    return new Response(JSON.stringify({ error: 'Place name required' }), { status: 400 });
  }

  const radiusMiles =
    typeof body.radius_miles === 'number' ? body.radius_miles : DEFAULT_LOCALE_RADIUS_MILES;
  if (!isAllowedRadiusMiles(radiusMiles)) {
    return new Response(
      JSON.stringify({ error: 'Radius must be one of 5, 10, 25, 50, or 100 miles' }),
      { status: 400 },
    );
  }

  let center_lat: number;
  let center_lng: number;
  let center_label: string | null = body.center_label?.trim() || null;

  try {
    const geo = await geocodeAddress(place);
    if (!geo) {
      return new Response(JSON.stringify({ error: 'Place not found' }), { status: 422 });
    }
    center_lat = geo.lat;
    center_lng = geo.lng;
    center_label = center_label || geo.formattedAddress;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geocode failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }

  let nestId = await getPrimaryNestId(supabase, user.id);
  if (!nestId) nestId = await ensureNestForUser(supabase, user.id);

  const entitlement = await assertNestEntitlement(supabase, nestId, 'create_locale');
  if ('denial' in entitlement) {
    return entitlementDenialResponse(entitlement.denial);
  }

  let listing_prefs = undefined;
  if (body.listing_prefs !== undefined) {
    const parsedPrefs = parseListingPrefsInput(body.listing_prefs);
    if (!parsedPrefs.ok) {
      return new Response(JSON.stringify({ error: parsedPrefs.error }), {
        status: 400,
      });
    }
    listing_prefs = parsedPrefs.prefs;
  }

  const { data, error } = await supabase
    .from('locales')
    .insert({
      nest_id: nestId,
      name: body.name.trim(),
      center_lat,
      center_lng,
      radius_m: milesToMeters(radiusMiles),
      center_label,
      ...(listing_prefs !== undefined ? { listing_prefs } : {}),
    })
    .select('id')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
