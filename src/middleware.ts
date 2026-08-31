import { defineMiddleware } from 'astro:middleware';
import { loadDevHuntPassPreviewForUser } from './lib/dev/hunt-pass-preview';
import { createSupabaseServerClient } from './lib/supabase/server';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith('/app')) {
    return next();
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabasePublishable = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishable) {
    return new Response('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY', {
      status: 500,
    });
  }

  const supabase = createSupabaseServerClient(context.request, context.cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  context.locals.user = user;
  context.locals.supabase = supabase;
  context.locals.devHuntPassPreview = await loadDevHuntPassPreviewForUser(supabase, user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('ui_theme_id, ui_show_borders')
    .eq('id', user.id)
    .maybeSingle();
  context.locals.profile = profile ?? null;

  return next();
});
