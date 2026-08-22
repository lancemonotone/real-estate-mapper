import type { APIRoute } from 'astro';
import { fillLocalePoisForType } from '../../../lib/proximity/fill-pois';
import { PLACE_TYPE_CATALOG, type PlaceTypeKey } from '../../../lib/proximity/place-types';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

function isPlaceTypeKey(key: string): key is PlaceTypeKey {
  return Object.prototype.hasOwnProperty.call(PLACE_TYPE_CATALOG, key);
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { locale_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const localeId = body.locale_id?.trim();
  if (!localeId) {
    return new Response(JSON.stringify({ error: 'locale_id required' }), { status: 400 });
  }

  const { data: locale, error: localeError } = await supabase
    .from('locales')
    .select('*')
    .eq('id', localeId)
    .single();

  if (localeError || !locale) {
    return new Response(
      JSON.stringify({ error: localeError?.message ?? 'Locale not found' }),
      { status: 404 },
    );
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('proximity_criteria')
    .select('place_type_key')
    .eq('locale_id', localeId)
    .eq('kind', 'place_type');

  if (criteriaError) {
    return new Response(JSON.stringify({ error: criteriaError.message }), { status: 500 });
  }

  const keys = new Set<PlaceTypeKey>();
  for (const row of criteria ?? []) {
    const key = row.place_type_key;
    if (key && isPlaceTypeKey(key)) {
      keys.add(key);
    }
  }

  const filled: Array<{ place_type_key: PlaceTypeKey; upsert_count: number }> = [];
  try {
    for (const key of keys) {
      const upsert_count = await fillLocalePoisForType(supabase, locale, key);
      filled.push({ place_type_key: key, upsert_count });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Places fill failed';
    return new Response(JSON.stringify({ error: message, filled }), { status: 500 });
  }

  return new Response(JSON.stringify({ filled }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
