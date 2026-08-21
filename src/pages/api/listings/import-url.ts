import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { extractListingFromHtml } from '../../../lib/listings/url-extract';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as { url?: string };
  const sourceUrl = body.url?.trim() ?? '';
  if (!sourceUrl) {
    return Response.json({ name: null, address: null, photoUrl: null, sourceUrl: '' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RealEstateMapper/1.0' },
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || !contentType.includes('text/html')) {
      return Response.json({ name: null, address: null, photoUrl: null, sourceUrl });
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return Response.json({ name: null, address: null, photoUrl: null, sourceUrl });
    }

    const html = new TextDecoder('utf-8').decode(buf);
    const extracted = extractListingFromHtml(html, sourceUrl);
    return Response.json({ ...extracted, sourceUrl });
  } catch {
    return Response.json({ name: null, address: null, photoUrl: null, sourceUrl });
  }
};
