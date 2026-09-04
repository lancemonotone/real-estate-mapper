export type AutoPlanPoolListing = {
  id: string;
  lat: number | null;
  lng: number | null;
  is_favorite?: boolean | null;
  is_passed?: boolean | null;
};

export type AutoPlanPoolOptions = {
  favoritesOnly?: boolean;
};

export type AutoPlanPoolResult<T extends AutoPlanPoolListing> = {
  geocoded: T[];
  skippedMissingGeo: number;
  skippedNotFavorite: number;
  skippedPassed: number;
};

/**
 * Unscheduled listings eligible for Auto-plan fill.
 * Passed listings are always excluded. Optionally restrict to favorites.
 */
export function selectUnscheduledGeocodedForAutoPlan<T extends AutoPlanPoolListing>(
  listings: T[],
  assignedIds: Set<string>,
  options: AutoPlanPoolOptions = {},
): AutoPlanPoolResult<T> {
  const favoritesOnly = options.favoritesOnly === true;
  const unassigned = listings.filter((l) => !assignedIds.has(l.id));

  let skippedPassed = 0;
  const notPassed = unassigned.filter((l) => {
    if (l.is_passed === true) {
      skippedPassed += 1;
      return false;
    }
    return true;
  });

  let skippedNotFavorite = 0;
  const favoriteScoped = favoritesOnly
    ? notPassed.filter((l) => {
        if (l.is_favorite === true) return true;
        skippedNotFavorite += 1;
        return false;
      })
    : notPassed;

  const geocoded = favoriteScoped.filter(
    (l) => typeof l.lat === 'number' && typeof l.lng === 'number',
  );
  const skippedMissingGeo = favoriteScoped.length - geocoded.length;

  return { geocoded, skippedMissingGeo, skippedNotFavorite, skippedPassed };
}
