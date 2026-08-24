import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { listingId?: string; favorite?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const listingId = typeof body.listingId === 'string' ? body.listingId : '';
  if (!listingId || typeof body.favorite !== 'boolean') {
    return Response.json({ ok: false, error: 'listingId and favorite required' }, { status: 400 });
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, locale_id')
    .eq('id', listingId)
    .maybeSingle();

  if (!listing) {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const locale = await getLocaleForNestMember(supabase, listing.locale_id);
  if (!locale) {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('listings')
    .update({
      is_favorite: body.favorite,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, favorite: body.favorite });
};
