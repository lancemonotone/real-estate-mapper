import type { APIRoute } from 'astro';
import { DEMO_COOKIE_NAME } from '../../../lib/demo/constants';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  await supabase.auth.signOut();
  cookies.delete(DEMO_COOKIE_NAME, { path: '/' });
  return redirect('/login');
};
