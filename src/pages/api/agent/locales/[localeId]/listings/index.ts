import type { APIRoute } from 'astro';
import {
  AGENT_LIST_SELECT,
  parseAgentListingPatch,
  upsertListingBySourceUrl,
} from '../../../../../../lib/listings/agent-write';
import { getLocaleForNestMember } from '../../../../../../lib/supabase/nest';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const GET: APIRoute = async ({ params, request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
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

  const { data, error } = await supabase
    .from('listings')
    .select(AGENT_LIST_SELECT)
    .eq('locale_id', localeId)
    .order('updated_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ listings: data ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseAgentListingPatch(body);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sourceUrl =
    typeof (body as { source_url?: unknown }).source_url === 'string'
      ? (body as { source_url: string }).source_url.trim()
      : '';
  if (!sourceUrl) {
    return new Response(JSON.stringify({ error: 'source_url required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await upsertListingBySourceUrl(supabase, {
      localeId,
      userId: user.id,
      sourceUrl,
      patch: parsed.patch,
    });
    return new Response(
      JSON.stringify({ listing: result.listing, created: result.created }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upsert failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
