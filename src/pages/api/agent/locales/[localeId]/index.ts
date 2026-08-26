import type { APIRoute } from 'astro';
import { getLocaleForNestMember } from '../../../../../lib/supabase/nest';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const GET: APIRoute = async ({ params, request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ?? (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const localeId = params.localeId?.trim() ?? '';
  if (!localeId) {
    return new Response(JSON.stringify({ error: 'localeId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) {
    return new Response(JSON.stringify({ error: 'Locale not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      locale: {
        id: locale.id,
        name: locale.name,
        center_label: locale.center_label,
        listing_prefs: locale.listing_prefs,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
