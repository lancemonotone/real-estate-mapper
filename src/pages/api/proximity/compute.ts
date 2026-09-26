import { forbidDemoMutation } from '../../../lib/demo/forbid';
import type { APIRoute } from 'astro';
import { computeProximityResult } from '../../../lib/proximity/compute-result';
import {
  assertNestEntitlement,
  entitlementDenialResponse,
} from '../../../lib/nest/entitlements';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const denied = forbidDemoMutation(locals);
  if (denied) return denied;

  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: {
    listing_id?: string;
    criterion_id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const listingId = body.listing_id?.trim();
  const criterionId = body.criterion_id?.trim();
  if (!listingId || !criterionId) {
    return new Response(
      JSON.stringify({
        error: 'listing_id and criterion_id required',
      }),
      { status: 400 },
    );
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('locale_id')
    .eq('id', listingId)
    .single();
  if (listingError || !listing) {
    return new Response(JSON.stringify({ error: 'Listing not found' }), { status: 404 });
  }

  const { data: locale, error: localeError } = await supabase
    .from('locales')
    .select('nest_id')
    .eq('id', listing.locale_id)
    .single();
  if (localeError || !locale) {
    return new Response(JSON.stringify({ error: 'Locale not found' }), { status: 404 });
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

  try {
    const result = await computeProximityResult(supabase, listingId, criterionId);
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Compute failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
