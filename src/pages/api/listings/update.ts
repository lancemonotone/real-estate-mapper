import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { geocodeAddress } from '../../../lib/google/geocode';
import { ensureLocaleCoversPoint } from '../../../lib/geo/ensure-locale-covers';
import { invalidateListingProximityResults } from '../../../lib/proximity/invalidate';
import {
  parseAmenities,
  parseOptionalInt,
  parseOptionalNumber,
} from '../../../lib/listings/format-attributes';
import { resolvePhotoFields } from '../../../lib/listings/photo-urls';
import { assertNestEntitlement } from '../../../lib/nest/entitlements';
import {
  parseListingTourFields,
  syncListingTour,
} from '../../../lib/tours/listing-tour-date';

function wantsJson(request: Request): boolean {
  return (request.headers.get('Accept') ?? '').includes('application/json');
}

function fail(request: Request, message: string, status: number) {
  if (wantsJson(request)) {
    return Response.json({ ok: false, error: message }, { status });
  }
  return new Response(message, { status });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (wantsJson(request)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return redirect('/login');
  }

  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  if (!id) return fail(request, 'Missing id', 400);

  const name = String(form.get('name') ?? '').trim() || null;
  const address = String(form.get('address') ?? '').trim() || null;
  const phone = String(form.get('phone') ?? '').trim() || null;
  const source_url = String(form.get('source_url') ?? '').trim() || null;
  const notes = String(form.get('notes') ?? '').trim() || null;
  const tour = parseListingTourFields(form.get('tour_date'), form.get('tour_time'));
  const appointment_at = tour.appointmentAt;
  const price_monthly = parseOptionalNumber(form.get('price_monthly'));
  const deposit = parseOptionalNumber(form.get('deposit'));
  const fees_monthly = parseOptionalNumber(form.get('fees_monthly'));
  const sqft = parseOptionalInt(form.get('sqft'));
  const beds = parseOptionalNumber(form.get('beds'));
  const baths = parseOptionalNumber(form.get('baths'));
  const pet_rent_monthly = parseOptionalNumber(form.get('pet_rent_monthly'));
  const pet_deposit = parseOptionalNumber(form.get('pet_deposit'));
  const amenities = parseAmenities(form.get('amenities'));

  const { data: existing } = await supabase
    .from('listings')
    .select('id, address, lat, lng, locale_id, photo_url, photo_urls, locales(nest_id)')
    .eq('id', id)
    .single();

  if (!existing) return fail(request, 'Not found', 404);

  const photos = resolvePhotoFields({
    photo_urls: form.getAll('photo_urls').map(String),
  });

  const nestId =
    existing.locales &&
    typeof existing.locales === 'object' &&
    'nest_id' in existing.locales
      ? String((existing.locales as { nest_id: string }).nest_id)
      : null;
  if (!nestId) return fail(request, 'Nest not found', 404);

  const entitlement = await assertNestEntitlement(supabase, nestId, 'add_photo', {
    photoCount: photos.photo_urls.length,
    userId: user.id,
  });
  if ('denial' in entitlement) {
    return fail(request, entitlement.denial.message, 403);
  }

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

  const coordsChanged = lat !== existing.lat || lng !== existing.lng;

  const { error } = await supabase
    .from('listings')
    .update({
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
      sqft,
      beds,
      baths,
      pet_rent_monthly,
      pet_deposit,
      amenities,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return fail(request, error.message, 400);

  const tourSync = await syncListingTour(
    supabase,
    existing.locale_id,
    id,
    tour.tourDate,
    tour.appointmentTime,
    user.id,
  );
  if (!tourSync.ok) return fail(request, tourSync.error, 400);

  if (coordsChanged) {
    await invalidateListingProximityResults(supabase, id);
  }

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

  if (wantsJson(request)) {
    return Response.json({
      ok: true,
      listing: {
        id,
        locale_id: existing.locale_id,
        name,
        address,
        phone,
        source_url,
        photo_url: photos.photo_url,
        photo_urls: photos.photo_urls,
        notes,
        price_monthly,
        deposit,
        fees_monthly,
        sqft,
        beds,
        baths,
        pet_rent_monthly,
        pet_deposit,
        amenities,
        lat,
        lng,
      },
    });
  }

  return redirect(`/app/locales/${existing.locale_id}/listings/${id}`);
};
