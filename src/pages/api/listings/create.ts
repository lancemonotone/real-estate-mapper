import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { ensureWorkspaceForUser, getPrimaryWorkspaceId } from '../../../lib/supabase/workspace';
import { geocodeAddress } from '../../../lib/google/geocode';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  let workspaceId = await getPrimaryWorkspaceId(supabase, user.id);
  if (!workspaceId) workspaceId = await ensureWorkspaceForUser(supabase, user.id);

  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim() || null;
  const address = String(form.get('address') ?? '').trim() || null;
  const source_url = String(form.get('source_url') ?? '').trim() || null;
  const photo_url = String(form.get('photo_url') ?? '').trim() || null;
  const notes = String(form.get('notes') ?? '').trim() || null;
  const appointmentRaw = String(form.get('appointment_at') ?? '').trim();
  const appointment_at = appointmentRaw ? new Date(appointmentRaw).toISOString() : null;

  let lat: number | null = null;
  let lng: number | null = null;
  if (address) {
    try {
      const geo = await geocodeAddress(address);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    } catch {
      // leave lat/lng null — visible Needs geocode badge
    }
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      workspace_id: workspaceId,
      name,
      address,
      source_url,
      photo_url,
      notes,
      appointment_at,
      lat,
      lng,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return new Response(error.message, { status: 400 });
  }

  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const path = `${workspaceId}/${listing.id}/${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from('listing-photos')
      .upload(path, photo, { upsert: true });
    if (!uploadError) {
      await supabase.from('listings').update({ photo_path: path }).eq('id', listing.id);
    }
  }

  return redirect(`/app/listings/${listing.id}`);
};
