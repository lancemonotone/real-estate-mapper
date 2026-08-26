import type { APIRoute } from 'astro';
import {
  agentPatchHasFields,
  parseAgentListingPatch,
  patchListingById,
} from '../../../../lib/listings/agent-write';
import { getLocaleForNestMember } from '../../../../lib/supabase/nest';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
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

  const listingId = params.id?.trim() ?? '';
  if (!listingId) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
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
  if (!agentPatchHasFields(parsed.patch)) {
    return new Response(
      JSON.stringify({ error: 'At least one field required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const { data: existing, error: findError } = await supabase
    .from('listings')
    .select('id, locale_id')
    .eq('id', listingId)
    .maybeSingle();

  if (findError) {
    return new Response(JSON.stringify({ error: findError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const locale = await getLocaleForNestMember(supabase, existing.locale_id);
  if (!locale) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const listing = await patchListingById(supabase, {
      listingId,
      patch: parsed.patch,
    });
    return new Response(JSON.stringify({ listing }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update failed';
    const status = message === 'Not found' ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
