import type { Listing } from '../../types/database';
import type { NestEntitlementSnapshot } from './types';
import { sliceVisiblePhotoUrls } from './resolve';

type WithPhotos = {
  photo_urls?: string[];
  photo_url?: string | null;
};

export function applyListingPhotoVisibility<T extends WithPhotos>(
  listing: T,
  snapshot: NestEntitlementSnapshot,
): T {
  const urls = listing.photo_urls;
  if (!urls?.length) return listing;
  const photo_urls = sliceVisiblePhotoUrls(urls, snapshot.plan);
  const photo_url = photo_urls[0] ?? listing.photo_url ?? null;
  return { ...listing, photo_urls, photo_url };
}

export function filterVisibleListings<T extends { id: string } & WithPhotos>(
  listings: T[],
  snapshot: NestEntitlementSnapshot,
): T[] {
  return listings
    .filter((listing) => snapshot.visibleListingIds.has(listing.id))
    .map((listing) => applyListingPhotoVisibility(listing, snapshot));
}

export function filterVisibleTourDays<T extends { id: string }>(
  tourDays: T[],
  snapshot: NestEntitlementSnapshot,
): T[] {
  return tourDays.filter((day) => snapshot.visibleTourDayIds.has(day.id));
}

export function isLocaleVisible(
  snapshot: NestEntitlementSnapshot,
  localeId: string,
): boolean {
  return snapshot.visibleLocaleIds.has(localeId);
}

export function isListingVisible(
  snapshot: NestEntitlementSnapshot,
  listingId: string,
): boolean {
  return snapshot.visibleListingIds.has(listingId);
}

export function isTourDayVisible(
  snapshot: NestEntitlementSnapshot,
  tourDayId: string,
): boolean {
  return snapshot.visibleTourDayIds.has(tourDayId);
}

export function filterListingStops<T extends { listings: Listing | null }>(
  stops: T[],
  snapshot: NestEntitlementSnapshot,
): T[] {
  return stops
    .filter((stop) => stop.listings && snapshot.visibleListingIds.has(stop.listings.id))
    .map((stop) => {
      if (!stop.listings) return stop;
      return { ...stop, listings: applyListingPhotoVisibility(stop.listings, snapshot) };
    });
}
