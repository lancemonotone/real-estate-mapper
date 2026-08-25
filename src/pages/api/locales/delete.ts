import type { APIRoute } from 'astro';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const DELETE: APIRoute = async ({ request, cookies, locals, url }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Locale id required' }), { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, id);
  if (!locale) {
    return new Response(JSON.stringify({ error: 'Locale not found' }), { status: 404 });
  }

  const { count, error: countError } = await supabase
    .from('locales')
    .select('id', { count: 'exact', head: true })
    .eq('nest_id', locale.nest_id);

  if (countError) {
    return new Response(JSON.stringify({ error: countError.message }), { status: 500 });
  }

  if ((count ?? 0) <= 1) {
    return new Response(
      JSON.stringify({ error: 'Cannot delete the last Locale in your Nest.' }),
      { status: 400 },
    );
  }

  const { error } = await supabase.from('locales').delete().eq('id', id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
