import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { buildOptimizePlan } from '../../../lib/google/optimize-request';
import { computeOptimizedRoute } from '../../../lib/google/routes';
import { geocodeAddress } from '../../../lib/google/geocode';
import { optimizeTourDay } from '../../../lib/tours/optimize-tour-day';
import { loadTourDayMapPayload } from '../../../lib/tours/tour-day-map-payload';

type LatLng = { lat: number; lng: number };

function readEndpoint(
  body: Record<string, unknown>,
  prefix: 'customStart' | 'customEnd',
): LatLng | null {
  const raw = body[prefix];
  if (!raw || typeof raw !== 'object') return null;
  const { lat, lng } = raw as { lat?: unknown; lng?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function assertDemoTourDayAllowed(
  locals: App.Locals,
  tourDayId: string,
): Promise<Response | null> {
  if (!locals.isDemo) return null;
  const nestId = locals.demoNestId;
  const supabase = locals.supabase;
  if (!nestId || !supabase) {
    return Response.json(
      { ok: false, error: 'Demo · not saved', code: 'demo_readonly' },
      { status: 403 },
    );
  }
  const { data: tour, error } = await supabase
    .from('tour_days')
    .select('id, locales!inner(nest_id)')
    .eq('id', tourDayId)
    .maybeSingle();
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  const locale = tour?.locales;
  const tourNestId =
    locale && typeof locale === 'object' && 'nest_id' in locale
      ? String((locale as { nest_id: string }).nest_id)
      : null;
  if (!tourNestId || tourNestId !== nestId) {
    return Response.json(
      { ok: false, error: 'Demo · not saved', code: 'demo_readonly' },
      { status: 403 },
    );
  }
  return null;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ?? (await supabase.auth.getUser()).data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const tourDayId = typeof body.tourDayId === 'string' ? body.tourDayId : undefined;
  const scratchListingIds = Array.isArray(body.scratchListingIds)
    ? (body.scratchListingIds as string[])
    : undefined;
  const startListingId =
    typeof body.startListingId === 'string' && body.startListingId
      ? body.startListingId
      : undefined;

  let customStart = readEndpoint(body, 'customStart');
  let customEnd = readEndpoint(body, 'customEnd');
  const customStartAddress =
    typeof body.customStartAddress === 'string' ? body.customStartAddress.trim() : '';
  const customEndAddress =
    typeof body.customEndAddress === 'string' ? body.customEndAddress.trim() : '';

  if (tourDayId) {
    const denied = await assertDemoTourDayAllowed(locals, tourDayId);
    if (denied) return denied;

    const preserveOrder = body.preserveOrder === true;
    const opt = await optimizeTourDay(supabase, tourDayId, {
      startListingId,
      ...(preserveOrder ? { preserveOrder: true } : {}),
    });
    if (!opt.ok) {
      return Response.json({ error: opt.error }, { status: opt.status });
    }
    const mapPayload = await loadTourDayMapPayload(supabase, tourDayId);
    return Response.json({ ok: true, map: mapPayload });
  }

  // Scratch optimize returns JSON only (no tour_days row). Demo may use it.
  if (locals.isDemo && !scratchListingIds?.length) {
    return Response.json(
      { ok: false, error: 'Demo · not saved', code: 'demo_readonly' },
      { status: 403 },
    );
  }

  if (!scratchListingIds?.length) {
    return Response.json({ error: 'Provide tourDayId or scratchListingIds' }, { status: 400 });
  }

  const listingIds = scratchListingIds;
  const resolvedStartListingId = startListingId;

  try {
    if (!customStart && customStartAddress) {
      const geo = await geocodeAddress(customStartAddress);
      if (!geo) {
        return Response.json({ error: 'Could not geocode custom start address' }, { status: 422 });
      }
      customStart = geo;
    }
    if (!customEnd && customEndAddress) {
      const geo = await geocodeAddress(customEndAddress);
      if (!geo) {
        return Response.json({ error: 'Could not geocode custom end address' }, { status: 422 });
      }
      customEnd = geo;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geocode failed';
    return Response.json({ error: message }, { status: 500 });
  }

  if (!customStart && !resolvedStartListingId) {
    return Response.json(
      { error: 'Set a start listing or a custom start address' },
      { status: 400 },
    );
  }

  const { data: listings, error: listError } = await supabase
    .from('listings')
    .select('id, lat, lng')
    .in('id', listingIds);

  if (listError) return Response.json({ error: listError.message }, { status: 400 });

  const geocoded = (listings ?? []).filter((l) => l.lat != null && l.lng != null);
  if (geocoded.length < 1) {
    return Response.json(
      { error: 'Optimize requires at least 1 geocoded listing' },
      { status: 400 },
    );
  }

  try {
    const plan = buildOptimizePlan(
      geocoded.map((l) => ({
        id: l.id,
        lat: l.lat!,
        lng: l.lng!,
        isStart: !customStart && l.id === resolvedStartListingId,
      })),
      { customStart, customEnd },
    );
    const result = await computeOptimizedRoute(plan);

    return Response.json({
      ok: true,
      ...result,
      customStart: customStart
        ? { ...customStart, address: customStartAddress || null }
        : null,
      customEnd: customEnd ? { ...customEnd, address: customEndAddress || null } : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Optimize failed';
    return Response.json({ error: message }, { status: 500 });
  }
};
