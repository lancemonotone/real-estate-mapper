import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { listingId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  if (!listingId) {
    return Response.json({ ok: false, error: 'listingId required' }, { status: 400 });
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

  const { error } = await supabase.from('listings').delete().eq('id', listingId);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, localeId: listing.locale_id });
};
