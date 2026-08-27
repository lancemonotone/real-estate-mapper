import type { APIRoute } from 'astro';
import { resolveUiBorders, uiShowBordersFromMode } from '../../../lib/ui/borders';
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

  let body: { ui_show_borders?: unknown };
  try {
    body = (await request.json()) as { ui_show_borders?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (typeof body.ui_show_borders !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'ui_show_borders must be a boolean' }),
      { status: 400 },
    );
  }

  const mode = resolveUiBorders(body.ui_show_borders);
  const ui_show_borders = uiShowBordersFromMode(mode);
  const { error } = await supabase
    .from('profiles')
    .update({ ui_show_borders })
    .eq('id', user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, ui_show_borders }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
