import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { buildListingPageSurface } from '../../../../lib/listings/listing-page-surface';

export const GET: APIRoute = async ({ params, request, cookies, locals }) => {
  const supabase = locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user = locals.user ?? (await supabase.auth.getUser()).data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const id = String(params.id ?? '').trim();
  if (!id) {
    return Response.json({ ok: false, error: 'Missing id' }, { status: 400 });
  }

  const tourDay = new URL(request.url).searchParams.get('tourDay');
  const surface = await buildListingPageSurface(supabase, id, user.id, { tourDay });
  if (!surface) {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  return Response.json({ ok: true, surface });
};
