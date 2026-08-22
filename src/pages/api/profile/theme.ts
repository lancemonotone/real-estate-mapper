import type { APIRoute } from 'astro';
import { isUiThemeId, resolveUiThemeId } from '../../../lib/ui/themes';
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

  let body: { ui_theme_id?: string };
  try {
    body = (await request.json()) as { ui_theme_id?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const raw = typeof body.ui_theme_id === 'string' ? body.ui_theme_id.trim() : '';
  if (!raw || !isUiThemeId(raw)) {
    return new Response(
      JSON.stringify({ error: 'ui_theme_id must be a known catalog theme' }),
      { status: 400 },
    );
  }

  const ui_theme_id = resolveUiThemeId(raw);
  const { error } = await supabase
    .from('profiles')
    .update({ ui_theme_id })
    .eq('id', user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, ui_theme_id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
