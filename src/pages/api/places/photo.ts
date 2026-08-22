import type { APIRoute } from 'astro';
import {
  fetchPlacePhotoBytes,
  resolvePlacePhotoName,
} from '../../../lib/google/places-photo';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies, locals, url }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const placeId = url.searchParams.get('place_id')?.trim() || '';
  const maxRaw = Number(url.searchParams.get('max') || '160');
  const maxPx = Number.isFinite(maxRaw) ? maxRaw : 160;

  if (!placeId) {
    return new Response('place_id required', { status: 400 });
  }

  try {
    const photoName = await resolvePlacePhotoName(placeId);
    if (!photoName) {
      return new Response(null, { status: 404 });
    }
    const { bytes, contentType } = await fetchPlacePhotoBytes(photoName, maxPx);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Photo failed';
    return new Response(message, { status: 502 });
  }
};
