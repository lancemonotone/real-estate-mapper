import type { APIRoute } from 'astro';
import { isDevToolsEnabled } from '../../../lib/dev/hunt-pass-preview';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isDevToolsEnabled()) {
    return new Response(JSON.stringify({ error: 'Developer tools are not enabled' }), {
      status: 403,
    });
  }

  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { dev_hunt_pass_preview?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (typeof body.dev_hunt_pass_preview !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'dev_hunt_pass_preview must be a boolean' }),
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('profiles')
    .update({ dev_hunt_pass_preview: body.dev_hunt_pass_preview })
    .eq('id', user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({ ok: true, dev_hunt_pass_preview: body.dev_hunt_pass_preview }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
