import { tourDayDriveLabel } from './tour-day-drive-total';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { tourListingStopGlyph } from './stop-glyph';

type Client = SupabaseClient<Database>;

export type TourDayMapPayload = {
  encodedPolyline: string;
  driveLabel: string | null;
  mapStops: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    photoUrl: string | null;
    sortOrder: number | null;
    legDurationSec: number | null;
    isStart: boolean;
    glyph: string;
    role: 'start' | 'end' | 'stop';
    kind: 'listing';
  }[];
  orderedListingIds: string[];
  customStart: {
    lat: number;
    lng: number;
    address: string | null;
    name: string | null;
  } | null;
  customEnd: {
    lat: number;
    lng: number;
    address: string | null;
    name: string | null;
  } | null;
};

export async function loadTourDayMapPayload(
  supabase: Client,
  tourDayId: string,
): Promise<TourDayMapPayload | null> {
  const { data: tour, error: tourError } = await supabase
    .from('tour_days')
    .select(
      'encoded_polyline, start_lat, start_lng, start_address, start_name, end_lat, end_lng, end_address, end_name',
    )
    .eq('id', tourDayId)
    .maybeSingle();

  if (tourError) throw new Error(tourError.message);
  if (!tour) return null;

  const { data: stops, error: stopsError } = await supabase
    .from('tour_stops')
    .select('listing_id, sort_order, leg_duration_sec, is_start, listings(name, address, lat, lng, photo_url)')
    .eq('tour_day_id', tourDayId)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (stopsError) throw new Error(stopsError.message);

  const hasCustomStart = tour.start_lat != null && tour.start_lng != null;
  const hasCustomEnd = tour.end_lat != null && tour.end_lng != null;
  const stopRows = stops ?? [];
  const listingCount = stopRows.length;

  const mapStops = stopRows
    .map((stop, index) => ({ stop, index }))
    .filter(
      ({ stop }) =>
        stop.listings &&
        stop.listings.lat != null &&
        stop.listings.lng != null,
    )
    .map(({ stop, index }) => {
      const listing = stop.listings!;
      const { glyph, role } = tourListingStopGlyph({
        hasCustomStart,
        hasCustomEnd,
        index,
        listingCount,
      });
      return {
        id: stop.listing_id,
        name: listing.name || listing.address || 'Stop',
        address: listing.address || '',
        lat: listing.lat!,
        lng: listing.lng!,
        photoUrl: listing.photo_url,
        sortOrder: stop.sort_order,
        legDurationSec: stop.leg_duration_sec,
        isStart: stop.is_start,
        glyph,
        role,
        kind: 'listing' as const,
      };
    });

  return {
    encodedPolyline: tour.encoded_polyline ?? '',
    driveLabel: tourDayDriveLabel({
      needsAutoroute: false,
      routeFresh: Boolean(tour.encoded_polyline),
      legDurationSecs: stopRows.map((stop) => stop.leg_duration_sec),
    }),
    mapStops,
    orderedListingIds: stopRows.map((stop) => stop.listing_id),
    customStart: hasCustomStart
      ? {
          lat: tour.start_lat!,
          lng: tour.start_lng!,
          address: tour.start_address,
          name: tour.start_name,
        }
      : null,
    customEnd: hasCustomEnd
      ? {
          lat: tour.end_lat!,
          lng: tour.end_lng!,
          address: tour.end_address,
          name: tour.end_name,
        }
      : null,
  };
}
