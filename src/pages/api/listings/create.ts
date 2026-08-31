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
import { resolvePhotoFields } from '../../../lib/listings/photo-urls';
import {
  assertNestEntitlement,
  entitlementDenialResponse,
} from '../../../lib/nest/entitlements';
import {
  parseListingTourFields,
  syncListingTour,
} from '../../../lib/tours/listing-tour-date';

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

  const entitlement = await assertNestEntitlement(supabase, locale.nest_id, 'add_listing', {
    localeId,
    userId: user.id,
  });
  if ('denial' in entitlement) {
    return entitlementDenialResponse(entitlement.denial);
  }

  const name = String(form.get('name') ?? '').trim() || null;
  const address = String(form.get('address') ?? '').trim() || null;
  const phone = String(form.get('phone') ?? '').trim() || null;
  const source_url = String(form.get('source_url') ?? '').trim() || null;
  const photos = resolvePhotoFields({
    photo_urls: form.getAll('photo_urls').map(String),
  });
  const notes = String(form.get('notes') ?? '').trim() || null;
  const tour = parseListingTourFields(form.get('tour_date'), form.get('tour_time'));
  const appointment_at = tour.appointmentAt;
  const price_monthly = parseOptionalNumber(form.get('price_monthly'));
  const deposit = parseOptionalNumber(form.get('deposit'));
  const fees_monthly = parseOptionalNumber(form.get('fees_monthly'));
  const application_fees = parseOptionalNumber(form.get('application_fees'));
  const move_in_fees = parseOptionalNumber(form.get('move_in_fees'));
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
      photo_url: photos.photo_url,
      photo_urls: photos.photo_urls,
      notes,
      appointment_at,
      lat,
      lng,
      price_monthly,
      deposit,
      fees_monthly,
      application_fees,
      move_in_fees,
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

  const tourSync = await syncListingTour(
    supabase,
    localeId,
    listing.id,
    tour.tourDate,
    tour.appointmentTime,
    user.id,
  );
  if (!tourSync.ok) return new Response(tourSync.error, { status: 400 });

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
