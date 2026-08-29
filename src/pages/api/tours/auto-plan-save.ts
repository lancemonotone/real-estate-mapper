import type { APIRoute } from 'astro';
import {
  checkAddTourDaysWithStopsBatch,
  entitlementDenialResponse,
  loadNestEntitlements,
} from '../../../lib/nest/entitlements';
import { loadDevHuntPassPreviewForUser } from '../../../lib/dev/hunt-pass-preview';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';

type SaveGroup = {
  tourDate?: string;
  listingIds?: string[];
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as {
    localeId?: string;
    groups?: SaveGroup[];
  };

  if (!body.localeId || !Array.isArray(body.groups) || body.groups.length === 0) {
    return Response.json({ error: 'localeId and groups required' }, { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, body.localeId);
  if (!locale) return Response.json({ error: 'Locale not found' }, { status: 404 });

  const devHuntPassPreview = await loadDevHuntPassPreviewForUser(supabase, user.id);
  const snapshot = await loadNestEntitlements(supabase, locale.nest_id, { devHuntPassPreview });
  if (!snapshot) return Response.json({ error: 'Nest not found' }, { status: 404 });

  const batchCheck = checkAddTourDaysWithStopsBatch(snapshot, body.groups.length);
  if (!batchCheck.ok) {
    return entitlementDenialResponse(batchCheck);
  }

  for (const [i, group] of body.groups.entries()) {
    if (!group.tourDate || !/^\d{4}-\d{2}-\d{2}$/.test(group.tourDate)) {
      return Response.json(
        { error: `Group ${i + 1}: tourDate required (YYYY-MM-DD)` },
        { status: 400 },
      );
    }
    if (!Array.isArray(group.listingIds) || group.listingIds.length === 0) {
      return Response.json({ error: `Group ${i + 1}: listingIds required` }, { status: 400 });
    }
  }

  const allIds = body.groups.flatMap((g) => g.listingIds!);
  if (new Set(allIds).size !== allIds.length) {
    return Response.json({ error: 'Duplicate listing across groups' }, { status: 400 });
  }

  const { data: listingRows, error: listError } = await supabase
    .from('listings')
    .select('id')
    .eq('locale_id', locale.id)
    .in('id', allIds);

  if (listError) return Response.json({ error: listError.message }, { status: 400 });
  if ((listingRows ?? []).length !== allIds.length) {
    return Response.json({ error: 'One or more listings are not in this Locale' }, { status: 400 });
  }

  const { data: tours } = await supabase
    .from('tour_days')
    .select('id')
    .eq('locale_id', locale.id);
  const tourDayIds = (tours ?? []).map((t) => t.id);
  if (tourDayIds.length > 0) {
    const { data: assignedStops } = await supabase
      .from('tour_stops')
      .select('listing_id')
      .in('tour_day_id', tourDayIds)
      .in('listing_id', allIds);
    if ((assignedStops ?? []).length > 0) {
      return Response.json(
        { error: 'One or more listings are already on a tour day' },
        { status: 400 },
      );
    }
  }

  const dates = body.groups.map((g) => g.tourDate!);
  if (new Set(dates).size !== dates.length) {
    return Response.json(
      { error: 'Each group needs a distinct tour date' },
      { status: 400 },
    );
  }

  const tourDayIdsCreated: string[] = [];

  for (const group of body.groups) {
    const { data: tourDay, error } = await supabase
      .from('tour_days')
      .upsert(
        { locale_id: body.localeId, tour_date: group.tourDate! },
        { onConflict: 'locale_id,tour_date' },
      )
      .select('id')
      .single();

    if (error || !tourDay) {
      return Response.json(
        { error: error?.message ?? `Could not create tour for ${group.tourDate}` },
        { status: 400 },
      );
    }

    const { count } = await supabase
      .from('tour_stops')
      .select('listing_id', { count: 'exact', head: true })
      .eq('tour_day_id', tourDay.id);

    if ((count ?? 0) > 0) {
      return Response.json(
        {
          error: `Tour day ${group.tourDate} already has stops — pick another date or clear that day first`,
        },
        { status: 400 },
      );
    }

    const rows = group.listingIds!.map((listingId, i) => ({
      tour_day_id: tourDay.id,
      listing_id: listingId,
      is_start: i === 0,
      sort_order: i,
    }));

    const { error: stopError } = await supabase.from('tour_stops').insert(rows);
    if (stopError) {
      return Response.json({ error: stopError.message }, { status: 400 });
    }

    tourDayIdsCreated.push(tourDay.id);
  }

  return Response.json({ ok: true, tourDayIds: tourDayIdsCreated });
};
