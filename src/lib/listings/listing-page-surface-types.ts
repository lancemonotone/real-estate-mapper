import type { ListingDisplayInput } from './listing-display';
import type { TourCalendarDayMeta } from '../nest/entitlements/tour-calendar';

export type TourCalendarClientConfig = {
  canAddNewTourDay: boolean;
  capMessage: string;
  hiddenMessage: string;
  allDaysByDate: Record<string, TourCalendarDayMeta>;
  dropBlockedByDate: Record<string, { reason: string; message: string }>;
};

export type ListingPageSurfaceCompareRow = {
  criterionId: string;
  label: string;
  travelMode: string;
  kind: string;
  placeTypeKey: string | null;
  textQuery: string | null;
  placeName: string;
  metaLabel: string;
  placeId: string;
  listingLat: string;
  listingLng: string;
  result: Record<string, unknown> | null;
};

export type ListingPageSurfaceListingPlace = {
  id: string;
  name: string;
  placeId: string;
  lat: number;
  lng: number;
  travelMode: string;
  durationSec: number | null;
  distanceM: number | null;
  mapsUrl: string | null;
  metaLabel: string;
};

export type ListingPageSurfaceTourCalendar = {
  weekKeys: string[];
  weekLabel: string;
  selectedDate: string;
  daysByDate: Record<string, { id: string; stopCount: number }>;
  dropBlocked: Record<string, 'cap' | 'hidden'>;
  blockNewTourDays: boolean;
  tourCalendar: TourCalendarClientConfig;
};

export type ListingPageSurfaceTour = {
  assignment: {
    tourDayId: string;
    tourDate: string;
    appointmentTime: string | null;
    hiddenOnPlan: boolean;
    formattedDate: string;
    formattedTime: string | null;
    toursHref: string;
  } | null;
  selectedDate: string;
  selectedDayStops: string[];
  addButton: {
    disabled: boolean;
    label: string;
    blockedMessage: string | null;
  };
  calendar: ListingPageSurfaceTourCalendar;
};

export type ListingPageSurfaceMapPlace = {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  placeId: string | null;
};

export type ListingPageSurface = {
  listing: ListingDisplayInput;
  tour: ListingPageSurfaceTour;
  travel: {
    empty: boolean;
    compareRows: ListingPageSurfaceCompareRow[];
    listingPlaces: ListingPageSurfaceListingPlace[];
  };
  map: {
    lat: number | null;
    lng: number | null;
    title: string;
    address: string | null;
    photoUrl: string | null;
    places: ListingPageSurfaceMapPlace[];
  };
  basePath: string;
};
