import type { APIRoute } from 'astro';
import { geocodeAddress } from '../../../lib/google/geocode';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const MILES_TO_METERS = 1609.344;

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
    radius_m?: number;
    center_label?: string | null;
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

  const patch: {
    name: string;
    center_lat?: number;
    center_lng?: number;
    center_label?: string | null;
    radius_m?: number;
    updated_at: string;
  } = {
    name: body.name.trim(),
    updated_at: new Date().toISOString(),
  };

  if (body.center_label !== undefined) {
    patch.center_label = body.center_label?.trim() || null;
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

  if (typeof body.radius_miles === 'number' && body.radius_miles > 0) {
    patch.radius_m = body.radius_miles * MILES_TO_METERS;
  } else if (typeof body.radius_m === 'number' && body.radius_m > 0) {
    patch.radius_m = body.radius_m;
  }

  const { error } = await supabase.from('locales').update(patch).eq('id', body.id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, id: body.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
