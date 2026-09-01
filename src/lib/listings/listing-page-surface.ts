import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import {
  applyListingPhotoVisibility,
  buildTourCalendarContext,
  isListingVisible,
  resolveTourDrop,
  tourCalendarClientConfig,
} from '../nest/entitlements';
import { getVisibleLocaleContext } from '../supabase/nest';
import { loadDevHuntPassPreviewForUser } from '../dev/hunt-pass-preview';
import { formatAppointmentTime } from '../tours/appointment-order';
import { formatShortTourDate, formatTourDate } from '../tours/format-tour-date';
import { parseDateKey, toDateKey, weekDateKeys } from '../tours/week';
import { formatTravelMeta } from './format-travel-meta';
import type { ListingDisplayInput } from './listing-display';
import type {
  ListingPageSurface,
  ListingPageSurfaceCompareRow,
  ListingPageSurfaceListingPlace,
  ListingPageSurfaceMapPlace,
  ListingPageSurfaceTour,
  ListingPageSurfaceTourCalendar,
} from './listing-page-surface-types';
export type {
  ListingPageSurface,
  ListingPageSurfaceCompareRow,
  ListingPageSurfaceListingPlace,
  ListingPageSurfaceMapPlace,
  ListingPageSurfaceTour,
  ListingPageSurfaceTourCalendar,
  TourCalendarClientConfig,
} from './listing-page-surface-types';
export { compareRowPlaceTypeKey } from './compare-row-place-type-key';

type Client = SupabaseClient<Database>;

export async function buildListingPageSurface(
  supabase: Client,
  listingId: string,
  userId: string,
  options?: { tourDay?: string | null; devHuntPassPreview?: boolean },
): Promise<ListingPageSurface | null> {
  const { data: listingRaw } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .maybeSingle();
  if (!listingRaw) return null;

  let devHuntPassPreview = options?.devHuntPassPreview ?? false;
  if (!devHuntPassPreview) {
    devHuntPassPreview = await loadDevHuntPassPreviewForUser(supabase, userId);
  }

  const localeContext = await getVisibleLocaleContext(
    supabase,
    listingRaw.locale_id,
    devHuntPassPreview,
  );
  if (!localeContext) return null;

  const { locale, snapshot } = localeContext;
  if (!isListingVisible(snapshot, listingRaw.id)) return null;

  const listing = applyListingPhotoVisibility(listingRaw, snapshot);
  const base = `/app/locales/${locale.id}`;

  const { data: listingPlaces } = await supabase
    .from('listing_places')
    .select('*')
    .eq('listing_id', listing.id)
    .order('updated_at', { ascending: false });

  const { data: criteria } = await supabase
    .from('proximity_criteria')
    .select('*')
    .eq('locale_id', locale.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const { data: proximityResults } = await supabase
    .from('proximity_results')
    .select('*')
    .eq('listing_id', listing.id);

  const resultByCriterion = new Map((proximityResults ?? []).map((r) => [r.criterion_id, r]));

  const { data: localeToursRaw } = await supabase
    .from('tour_days')
    .select('id, tour_date')
    .eq('locale_id', locale.id)
    .order('tour_date', { ascending: true });

  const allLocaleTourIds = (localeToursRaw ?? []).map((t) => t.id);
  const { data: allLocaleStopsForCal } =
    allLocaleTourIds.length > 0
      ? await supabase
          .from('tour_stops')
          .select('tour_day_id, listing_id')
          .in('tour_day_id', allLocaleTourIds)
      : { data: [] as { tour_day_id: string; listing_id: string }[] };

  const listingTourCal = buildTourCalendarContext(
    snapshot,
    (localeToursRaw ?? []).map((day) => ({ id: day.id, tour_date: day.tour_date })),
    allLocaleStopsForCal ?? [],
  );

  let assignment: ListingPageSurfaceTour['assignment'] = null;
  if (allLocaleTourIds.length > 0) {
    const { data: stop } = await supabase
      .from('tour_stops')
      .select('tour_day_id, appointment_time')
      .eq('listing_id', listing.id)
      .in('tour_day_id', allLocaleTourIds)
      .limit(1)
      .maybeSingle();
    if (stop) {
      const day = (localeToursRaw ?? []).find((t) => t.id === stop.tour_day_id);
      if (day) {
        const hiddenOnPlan = !snapshot.visibleTourDayIds.has(day.id);
        assignment = {
          tourDayId: day.id,
          tourDate: day.tour_date,
          appointmentTime: (stop.appointment_time as string | null) ?? null,
          hiddenOnPlan,
          formattedDate: formatTourDate(day.tour_date),
          formattedTime: stop.appointment_time
            ? formatAppointmentTime(stop.appointment_time as string)
            : null,
          toursHref: hiddenOnPlan
            ? `${base}/tours?day=${day.tour_date}`
            : `${base}/tours/${day.id}`,
        };
      }
    }
  }

  const tourDayParam = options?.tourDay;
  const selectedDate =
    tourDayParam && /^\d{4}-\d{2}-\d{2}$/.test(tourDayParam)
      ? tourDayParam
      : assignment?.tourDate ?? toDateKey(new Date());

  const addDecision = resolveTourDrop(listingTourCal, selectedDate);
  const addBlocked = addDecision.ok === false ? addDecision.message : null;

  const selectedTour = (localeToursRaw ?? []).find((t) => t.tour_date === selectedDate);
  let selectedDayStops: string[] = [];
  if (selectedTour) {
    const { data: dayStops } = await supabase
      .from('tour_stops')
      .select('listings(name, address)')
      .eq('tour_day_id', selectedTour.id)
      .order('sort_order', { ascending: true, nullsFirst: false });
    selectedDayStops = (dayStops ?? []).map((s) => {
      const row = s.listings as { name: string | null; address: string | null } | null;
      return row?.name || row?.address || 'Stop';
    });
  }

  const alreadyOnDay = assignment?.tourDate === selectedDate;
  const addButton = {
    disabled: alreadyOnDay || Boolean(addBlocked),
    label: alreadyOnDay
      ? 'Already on this day'
      : addBlocked
        ? 'Cannot add to this day'
        : 'Add to this day',
    blockedMessage: addBlocked,
  };

  const stopCountByDayId = new Map<string, number>();
  for (const stop of allLocaleStopsForCal ?? []) {
    stopCountByDayId.set(
      stop.tour_day_id,
      (stopCountByDayId.get(stop.tour_day_id) ?? 0) + 1,
    );
  }

  const visibleTourDays = (localeToursRaw ?? []).filter((day) =>
    snapshot.visibleTourDayIds.has(day.id),
  );
  const daysByDate: Record<string, { id: string; stopCount: number }> = {};
  for (const tour of visibleTourDays) {
    daysByDate[tour.tour_date] = {
      id: tour.id,
      stopCount: stopCountByDayId.get(tour.id) ?? 0,
    };
  }

  const dropBlocked = Object.fromEntries(
    Object.entries(listingTourCal.dropBlockedByDate).map(([date, block]) => [
      date,
      block.reason,
    ]),
  ) as Record<string, 'cap' | 'hidden'>;

  const weekKeys = weekDateKeys(parseDateKey(selectedDate));
  const weekLabel = `${formatShortTourDate(weekKeys[0]!)} → ${formatShortTourDate(weekKeys[6]!)}`;

  const calendar: ListingPageSurfaceTourCalendar = {
    weekKeys,
    weekLabel,
    selectedDate,
    daysByDate,
    dropBlocked,
    blockNewTourDays: !listingTourCal.canAddNewTourDay,
    tourCalendar: tourCalendarClientConfig(listingTourCal),
  };

  const compareRows: ListingPageSurfaceCompareRow[] = (criteria ?? []).map((c) => {
    const row = resultByCriterion.get(c.id);
    const placeName = row?.status === 'ok' ? row.place_name ?? '' : '';
    const metaLabel =
      row?.status === 'ok'
        ? formatTravelMeta(row.duration_sec, row.distance_m)
        : row
          ? row.status
          : 'Pending…';
    return {
      criterionId: c.id,
      label: c.label,
      travelMode: c.travel_mode,
      kind: c.kind,
      placeTypeKey: c.place_type_key,
      textQuery: c.text_query,
      placeName,
      metaLabel,
      placeId: row?.place_id ?? '',
      listingLat: listing.lat != null ? String(listing.lat) : '',
      listingLng: listing.lng != null ? String(listing.lng) : '',
      result: row ? (row as unknown as Record<string, unknown>) : null,
    };
  });

  const travelListingPlaces: ListingPageSurfaceListingPlace[] = (listingPlaces ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    placeId: p.place_id,
    lat: p.lat,
    lng: p.lng,
    travelMode: p.travel_mode,
    durationSec: p.duration_sec,
    distanceM: p.distance_m,
    mapsUrl: p.maps_url,
    metaLabel: [formatTravelMeta(p.duration_sec, p.distance_m), p.travel_mode]
      .filter(Boolean)
      .join(' · '),
  }));

  const mapPlaces: ListingPageSurfaceMapPlace[] = [
    ...compareRows
      .filter((row) => row.result?.status === 'ok' && row.result.place_lat != null)
      .map((row) => ({
        id: `criterion:${row.criterionId}`,
        name: String(row.result?.place_name || row.label),
        label: row.label,
        lat: Number(row.result?.place_lat),
        lng: Number(row.result?.place_lng),
        placeId: typeof row.result?.place_id === 'string' ? row.result.place_id : null,
      })),
    ...(listingPlaces ?? []).map((p) => ({
      id: `listing-place:${p.id}`,
      name: p.name,
      label: p.label || p.name,
      lat: p.lat,
      lng: p.lng,
      placeId: p.place_id,
    })),
  ];

  const photoUrl = listing.photo_url ?? '';
  const photoUrls =
    listing.photo_urls?.length > 0 ? listing.photo_urls : photoUrl ? [photoUrl] : [];

  return {
    listing: {
      name: listing.name,
      address: listing.address,
      phone: listing.phone,
      source_url: listing.source_url,
      photo_urls: photoUrls,
      photo_url: photoUrl || null,
      notes: listing.notes,
      price_monthly: listing.price_monthly,
      deposit: listing.deposit,
      fees_monthly: listing.fees_monthly,
      application_fees: listing.application_fees,
      move_in_fees: listing.move_in_fees,
      sqft: listing.sqft,
      beds: listing.beds,
      baths: listing.baths,
      pet_rent_monthly: listing.pet_rent_monthly,
      pet_deposit: listing.pet_deposit,
      amenities: listing.amenities,
      lat: listing.lat,
      lng: listing.lng,
    },
    tour: {
      assignment,
      selectedDate,
      selectedDayStops,
      addButton,
      calendar,
    },
    travel: {
      empty: compareRows.length === 0 && travelListingPlaces.length === 0,
      compareRows,
      listingPlaces: travelListingPlaces,
    },
    map: {
      lat: listing.lat,
      lng: listing.lng,
      title: listing.name || 'Listing',
      address: listing.address,
      photoUrl: photoUrls[0] ?? null,
      places: mapPlaces,
    },
    basePath: base,
  };
}
