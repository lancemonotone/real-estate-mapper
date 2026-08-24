import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
import {
  AUTO_PLAN_MAX_PER_CLUSTER,
  AUTO_PLAN_RADIUS_MILES,
  clusterListingsByProximity,
} from '../../../lib/tours/cluster-listings';
import { milesToMeters } from '../../../lib/geo/locale-radius';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as { localeId?: string };
  if (!body.localeId) {
    return Response.json({ error: 'localeId required' }, { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, body.localeId);
  if (!locale) return Response.json({ error: 'Locale not found' }, { status: 404 });

  const { data: tours } = await supabase
    .from('tour_days')
    .select('id')
    .eq('locale_id', locale.id);

  const tourDayIds = (tours ?? []).map((t) => t.id);
  const { data: assignedStops } =
    tourDayIds.length > 0
      ? await supabase.from('tour_stops').select('listing_id').in('tour_day_id', tourDayIds)
      : { data: [] as { listing_id: string }[] };
  const assignedIds = new Set((assignedStops ?? []).map((a) => a.listing_id));

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, name, address, lat, lng')
    .eq('locale_id', locale.id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  const unassigned = (listings ?? []).filter((l) => !assignedIds.has(l.id));
  const geocoded = unassigned.filter(
    (l) => typeof l.lat === 'number' && typeof l.lng === 'number',
  );
  const skippedMissingGeo = unassigned.length - geocoded.length;

  if (geocoded.length === 0) {
    return Response.json({
      ok: false,
      error:
        skippedMissingGeo > 0
          ? `No geocoded unassigned listings (${skippedMissingGeo} missing location).`
          : 'No unassigned listings to cluster.',
      clusters: [],
      skippedMissingGeo,
      radiusMiles: AUTO_PLAN_RADIUS_MILES,
      maxPerCluster: AUTO_PLAN_MAX_PER_CLUSTER,
    });
  }

  const idClusters = clusterListingsByProximity(
    geocoded.map((l) => ({ id: l.id, lat: l.lat!, lng: l.lng! })),
    {
      radiusM: milesToMeters(AUTO_PLAN_RADIUS_MILES),
      maxPerCluster: AUTO_PLAN_MAX_PER_CLUSTER,
    },
  );

  const byId = new Map(geocoded.map((l) => [l.id, l]));
  const clusters = idClusters.map((listingIds, index) => ({
    index,
    listingIds,
    labels: listingIds.map((id) => {
      const row = byId.get(id);
      return row?.name || row?.address || id;
    }),
  }));

  return Response.json({
    ok: true,
    clusters,
    skippedMissingGeo,
    radiusMiles: AUTO_PLAN_RADIUS_MILES,
    maxPerCluster: AUTO_PLAN_MAX_PER_CLUSTER,
  });
};
