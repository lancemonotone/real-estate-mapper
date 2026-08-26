import type { ListingPrefs } from '../types/database';

export function validateListingPrefs(
  prefs: unknown,
): prefs is ListingPrefs {
  if (!prefs || typeof prefs !== 'object') return false;
  const p = prefs as Record<string, unknown>;
  if (typeof p.target_beds !== 'number' || !Number.isFinite(p.target_beds)) {
    return false;
  }
  if (p.target_beds < 1 || p.target_beds > 9) return false;
  if (!p.pets || typeof p.pets !== 'object') return false;
  const pets = p.pets as Record<string, unknown>;
  return (
    typeof pets.cats === 'number' &&
    Number.isFinite(pets.cats) &&
    pets.cats >= 0 &&
    pets.cats <= 9 &&
    typeof pets.dogs === 'number' &&
    Number.isFinite(pets.dogs) &&
    pets.dogs >= 0 &&
    pets.dogs <= 9
  );
}

export type ListingPrefsInput = {
  target_beds?: unknown;
  pets?: {
    cats?: unknown;
    dogs?: unknown;
  };
};

export function parseListingPrefsInput(
  input: ListingPrefsInput | null | undefined,
): { ok: true; prefs: ListingPrefs } | { ok: false; error: string } {
  if (!input) {
    return { ok: false, error: 'Listing import preferences required' };
  }

  const prefs = {
    target_beds: input.target_beds,
    pets: {
      cats: input.pets?.cats,
      dogs: input.pets?.dogs,
    },
  };

  if (!validateListingPrefs(prefs)) {
    return {
      ok: false,
      error:
        'Listing import preferences must include bedrooms (1–9) and pet counts (0–9 each)',
    };
  }

  return { ok: true, prefs };
}

export const LISTING_BED_OPTIONS = [1, 2, 3, 4] as const;
