import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { buildFillPreview } from '../../../lib/tours/fill-date-range-db';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as {
    localeId?: string;
    startDate?: string;
    endDate?: string;
    favoritesOnly?: boolean;
    skipPassed?: boolean;
  };

  if (!body.localeId || !body.startDate || !body.endDate) {
    return Response.json(
      { error: 'localeId, startDate, and endDate required' },
      { status: 400 },
    );
  }

  const result = await buildFillPreview(
    supabase,
    body.localeId,
    body.startDate,
    body.endDate,
    {
      favoritesOnly: body.favoritesOnly === true,
      skipPassed: body.skipPassed !== false,
    },
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result);
};
