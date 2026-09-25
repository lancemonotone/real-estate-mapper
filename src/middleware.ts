import { defineMiddleware } from 'astro:middleware';
import { DEMO_COOKIE_NAME } from './lib/demo/constants';
import { getDemoSessionSecret } from './lib/demo/nest';
import { verifyDemoCookie } from './lib/demo/session';
import { createSyntheticDemoUser } from './lib/demo/synthetic-user';
import { loadDevHuntPassPreviewForUser } from './lib/dev/hunt-pass-preview';
import { createSupabaseAdminClient } from './lib/supabase/admin';
import { createSupabaseServerClient } from './lib/supabase/server';

function needsAuthLocals(pathname: string): boolean {
  return pathname.startsWith('/app') || pathname.startsWith('/api');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!needsAuthLocals(pathname)) {
    return next();
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabasePublishable = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishable) {
    if (pathname.startsWith('/app')) {
      return new Response(
        'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        { status: 500 },
      );
    }
    return next();
  }

  const supabase = createSupabaseServerClient(context.request, context.cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    context.locals.isDemo = false;
    context.locals.user = user;
    context.locals.supabase = supabase;
    context.locals.devHuntPassPreview = await loadDevHuntPassPreviewForUser(
      supabase,
      user.id,
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('ui_theme_id, ui_show_borders')
      .eq('id', user.id)
      .maybeSingle();
    context.locals.profile = profile ?? null;

    return next();
  }

  const sessionSecret = getDemoSessionSecret();
  const demoRaw = context.cookies.get(DEMO_COOKIE_NAME)?.value ?? '';
  const demoPayload =
    sessionSecret && demoRaw
      ? verifyDemoCookie(demoRaw, sessionSecret)
      : null;

  if (demoPayload) {
    context.locals.isDemo = true;
    context.locals.demoNestId = demoPayload.nestId;
    context.locals.user = createSyntheticDemoUser();
    context.locals.supabase = createSupabaseAdminClient();
    context.locals.devHuntPassPreview = false;
    context.locals.profile = null;
    return next();
  }

  if (pathname.startsWith('/app')) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  return next();
});
