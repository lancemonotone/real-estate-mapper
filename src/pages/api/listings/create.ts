import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';
import { geocodeAddress } from '../../../lib/google/geocode';
import { ensureLocaleCoversPoint } from '../../../lib/geo/ensure-locale-covers';
import {
  parseAmenities,
  parseOptionalInt,
  parseOptionalNumber,
} from '../../../lib/listings/format-attributes';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const form = await request.formData();
  const localeId = String(form.get('locale_id') ?? '');
  if (!localeId) return new Response('Missing locale_id', { status: 400 });

  const locale = await getLocaleForNestMember(supabase, localeId);
  if (!locale) return new Response('Locale not found', { status: 404 });

  const name = String(form.get('name') ?? '').trim() || null;
  const address = String(form.get('address') ?? '').trim() || null;
  const phone = String(form.get('phone') ?? '').trim() || null;
  const source_url = String(form.get('source_url') ?? '').trim() || null;
  const photo_url = String(form.get('photo_url') ?? '').trim() || null;
  const notes = String(form.get('notes') ?? '').trim() || null;
  const appointmentRaw = String(form.get('appointment_at') ?? '').trim();
  const appointment_at = appointmentRaw ? new Date(appointmentRaw).toISOString() : null;
  const price_monthly = parseOptionalNumber(form.get('price_monthly'));
  const deposit = parseOptionalNumber(form.get('deposit'));
  const fees_monthly = parseOptionalNumber(form.get('fees_monthly'));
  const sqft = parseOptionalInt(form.get('sqft'));
  const beds = parseOptionalNumber(form.get('beds'));
  const baths = parseOptionalNumber(form.get('baths'));
  const pet_rent_monthly = parseOptionalNumber(form.get('pet_rent_monthly'));
  const pet_deposit = parseOptionalNumber(form.get('pet_deposit'));
  const amenities = parseAmenities(form.get('amenities'));

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
      locale_id: localeId,
      name,
      address,
      phone,
      source_url,
      photo_url,
      notes,
      appointment_at,
      lat,
      lng,
      price_monthly,
      deposit,
      fees_monthly,
      sqft,
      beds,
      baths,
      pet_rent_monthly,
      pet_deposit,
      amenities,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return new Response(error.message, { status: 400 });
  }

  if (lat != null && lng != null) {
    await ensureLocaleCoversPoint(supabase, localeId, { lat, lng });
  }

  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const path = `${locale.nest_id}/${listing.id}/${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from('listing-photos')
      .upload(path, photo, { upsert: true });
    if (!uploadError) {
      await supabase.from('listings').update({ photo_path: path }).eq('id', listing.id);
    }
  }

  return redirect(`/app/locales/${localeId}/listings/${listing.id}`);
};
