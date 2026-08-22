import type { APIRoute } from 'astro';
import { computeProximityResult, computeStaleForLocale } from '../../../lib/proximity/compute-result';
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

  let body: {
    listing_id?: string;
    criterion_id?: string;
    locale_id?: string;
    refresh_stale?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (body.refresh_stale === true) {
    const localeId = body.locale_id?.trim();
    if (!localeId) {
      return new Response(
        JSON.stringify({ error: 'locale_id required when refresh_stale is true' }),
        { status: 400 },
      );
    }
    try {
      const results = await computeStaleForLocale(supabase, localeId);
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Compute failed';
      return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
  }

  const listingId = body.listing_id?.trim();
  const criterionId = body.criterion_id?.trim();
  if (!listingId || !criterionId) {
    return new Response(
      JSON.stringify({
        error: 'listing_id and criterion_id required (or locale_id with refresh_stale)',
      }),
      { status: 400 },
    );
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
