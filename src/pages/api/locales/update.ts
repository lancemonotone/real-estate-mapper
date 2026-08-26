import type { APIRoute } from 'astro';
import {
  isAllowedRadiusMiles,
  milesToMeters,
} from '../../../lib/geo/locale-radius';
import { geocodeAddress } from '../../../lib/google/geocode';
import { invalidateLocaleProximityCache } from '../../../lib/proximity/invalidate';
import type { ListingPrefs } from '../../../lib/types/database';
import { parseListingPrefsInput } from '../../../lib/listings/listing-prefs';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
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
    id?: string;
    name?: string;
    place?: string;
    radius_miles?: number;
    center_label?: string | null;
    listing_prefs?: {
      target_beds?: unknown;
      pets?: { cats?: unknown; dogs?: unknown };
    };
  };

  if (!body.id) {
    return new Response(JSON.stringify({ error: 'Locale id required' }), { status: 400 });
  }
  if (!body.name?.trim()) {
    return new Response(JSON.stringify({ error: 'Name required' }), { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, body.id);
  if (!locale) {
    return new Response(JSON.stringify({ error: 'Locale not found' }), { status: 404 });
  }

  if (typeof body.radius_miles !== 'number' || !isAllowedRadiusMiles(body.radius_miles)) {
    return new Response(
      JSON.stringify({ error: 'Radius must be one of 5, 10, 25, 50, or 100 miles' }),
      { status: 400 },
    );
  }

  const patch: {
    name: string;
    center_lat?: number;
    center_lng?: number;
    center_label?: string | null;
    radius_m: number;
    listing_prefs?: ListingPrefs;
    updated_at: string;
  } = {
    name: body.name.trim(),
    radius_m: milesToMeters(body.radius_miles),
    updated_at: new Date().toISOString(),
  };

  if (body.center_label !== undefined) {
    patch.center_label = body.center_label?.trim() || null;
  }

  if (body.listing_prefs !== undefined) {
    const parsedPrefs = parseListingPrefsInput(body.listing_prefs);
    if (!parsedPrefs.ok) {
      return new Response(JSON.stringify({ error: parsedPrefs.error }), {
        status: 400,
      });
    }
    patch.listing_prefs = parsedPrefs.prefs;
  }

  const place = body.place?.trim() ?? '';
  if (place) {
    try {
      const geo = await geocodeAddress(place);
      if (!geo) {
        return new Response(JSON.stringify({ error: 'Place not found' }), {
          status: 422,
        });
      }
      patch.center_lat = geo.lat;
      patch.center_lng = geo.lng;
      if (!patch.center_label) patch.center_label = geo.formattedAddress;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Geocode failed';
      return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
  }

  const geometryChanged =
    patch.center_lat != null ||
    patch.center_lng != null ||
    patch.radius_m !== locale.radius_m;

  const { error } = await supabase.from('locales').update(patch).eq('id', body.id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (geometryChanged) {
    try {
      await invalidateLocaleProximityCache(supabase, body.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Proximity cache invalidate failed';
      return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ ok: true, id: body.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
