import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { geocodeAddress } from '../../../lib/google/geocode';
import { ensureLocaleCoversPoint } from '../../../lib/geo/ensure-locale-covers';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  if (!id) return new Response('Missing id', { status: 400 });

  const name = String(form.get('name') ?? '').trim() || null;
  const address = String(form.get('address') ?? '').trim() || null;
  const source_url = String(form.get('source_url') ?? '').trim() || null;
  const photo_url = String(form.get('photo_url') ?? '').trim() || null;
  const notes = String(form.get('notes') ?? '').trim() || null;
  const appointmentRaw = String(form.get('appointment_at') ?? '').trim();
  const appointment_at = appointmentRaw ? new Date(appointmentRaw).toISOString() : null;

  const { data: existing } = await supabase
    .from('listings')
    .select('id, address, lat, lng, locale_id, locales(nest_id)')
    .eq('id', id)
    .single();

  if (!existing) return new Response('Not found', { status: 404 });

  let lat = existing.lat;
  let lng = existing.lng;
  if (address && address !== existing.address) {
    try {
      const geo = await geocodeAddress(address);
      lat = geo?.lat ?? null;
      lng = geo?.lng ?? null;
    } catch {
      lat = null;
      lng = null;
    }
  }

  const { error } = await supabase
    .from('listings')
    .update({
      name,
      address,
      source_url,
      photo_url,
      notes,
      appointment_at,
      lat,
      lng,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return new Response(error.message, { status: 400 });

  if (lat != null && lng != null) {
    await ensureLocaleCoversPoint(supabase, existing.locale_id, { lat, lng });
  }

  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const nestId =
      existing.locales &&
      typeof existing.locales === 'object' &&
      'nest_id' in existing.locales
        ? String((existing.locales as { nest_id: string }).nest_id)
        : existing.locale_id;
    const path = `${nestId}/${id}/${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from('listing-photos')
      .upload(path, photo, { upsert: true });
    if (!uploadError) {
      await supabase.from('listings').update({ photo_path: path }).eq('id', id);
    }
  }

  return redirect(`/app/locales/${existing.locale_id}/listings/${id}`);
};
