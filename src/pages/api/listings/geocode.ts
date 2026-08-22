import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { geocodeAddress } from '../../../lib/google/geocode';
import { ensureLocaleCoversPoint } from '../../../lib/geo/ensure-locale-covers';
import { invalidateListingProximityResults } from '../../../lib/proximity/invalidate';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as { id?: string };
  if (!body.id) return new Response('Missing id', { status: 400 });

  const { data: listing } = await supabase
    .from('listings')
    .select('id, address, locale_id, lat, lng')
    .eq('id', body.id)
    .single();

  if (!listing?.address) {
    return Response.json({ ok: false, error: 'Listing has no address' }, { status: 400 });
  }

  try {
    const geo = await geocodeAddress(listing.address);
    if (!geo) {
      await supabase
        .from('listings')
        .update({ lat: null, lng: null })
        .eq('id', listing.id);
      if (listing.lat != null || listing.lng != null) {
        await invalidateListingProximityResults(supabase, listing.id);
      }
      return Response.json({ ok: false, error: 'Geocode returned no results' }, { status: 422 });
    }
    await supabase
      .from('listings')
      .update({ lat: geo.lat, lng: geo.lng })
      .eq('id', listing.id);
    if (geo.lat !== listing.lat || geo.lng !== listing.lng) {
      await invalidateListingProximityResults(supabase, listing.id);
    }
    await ensureLocaleCoversPoint(supabase, listing.locale_id, geo);
    return Response.json({ ok: true, ...geo });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geocode failed';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
};
