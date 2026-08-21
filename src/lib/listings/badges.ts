import type { Listing } from '../lib/types/database';

export function listingBadges(listing: Pick<Listing, 'address' | 'lat' | 'lng' | 'photo_path' | 'photo_url'>) {
  const badges: string[] = [];
  if (!listing.address?.trim()) badges.push('Needs address');
  if (listing.lat == null || listing.lng == null) badges.push('Needs geocode');
  if (!listing.photo_path && !listing.photo_url) badges.push('No photo');
  return badges;
}
