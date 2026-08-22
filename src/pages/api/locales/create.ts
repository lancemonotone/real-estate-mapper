import type { APIRoute } from 'astro';
import { DEFAULT_NEW_LOCALE_RADIUS_M } from '../../../lib/geo/locale-area';
import { ensureNestForUser, getPrimaryNestId } from '../../../lib/supabase/nest';
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

  const body = (await request.json()) as {
    name?: string;
    center_lat?: number;
    center_lng?: number;
    radius_m?: number;
    center_label?: string | null;
  };

  if (!body.name?.trim()) {
    return new Response(JSON.stringify({ error: 'Name required' }), { status: 400 });
  }
  if (
    typeof body.center_lat !== 'number' ||
    typeof body.center_lng !== 'number' ||
    Number.isNaN(body.center_lat) ||
    Number.isNaN(body.center_lng)
  ) {
    return new Response(JSON.stringify({ error: 'Center lat/lng required' }), {
      status: 400,
    });
  }

  let nestId = await getPrimaryNestId(supabase, user.id);
  if (!nestId) nestId = await ensureNestForUser(supabase, user.id);

  const radius_m =
    typeof body.radius_m === 'number' && body.radius_m > 0
      ? body.radius_m
      : DEFAULT_NEW_LOCALE_RADIUS_M;

  const { data, error } = await supabase
    .from('locales')
    .insert({
      nest_id: nestId,
      name: body.name.trim(),
      center_lat: body.center_lat,
      center_lng: body.center_lng,
      radius_m,
      center_label: body.center_label ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
