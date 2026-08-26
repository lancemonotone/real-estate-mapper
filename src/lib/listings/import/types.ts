import type { ListingPrefs } from '../../types/database.ts';

export type ParsedListing = {
  name: string | null;
  address: string | null;
  phone: string | null;
  photo_url: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  price_monthly: number | null;
  fees_monthly: number | null;
  deposit: number | null;
  pet_deposit: number | null;
  pet_rent_monthly: number | null;
  amenities: string[];
  notes: string | null;
};

export type ParseSuccess = {
  ok: true;
  source: 'zillow';
  source_url: string;
  listing: ParsedListing;
  warnings: string[];
  photo_candidates: string[];
};

export type ParseFailure = {
  ok: false;
  error: string;
};

export type ParseResult = ParseSuccess | ParseFailure;

export type ZillowUnit = {
  unit: string;
  beds: number;
  baths: number;
  sqft: number;
  rent: number;
};

export type ZillowExtract = {
  name: string | null;
  address: string | null;
  phone: string | null;
  photoCandidates: string[];
  units: ZillowUnit[];
  rawAmenities: string[];
  requiredMonthlyFees: number[];
  deposit: number | null;
  catOneTimeFee: number | null;
  dogOneTimeFee: number | null;
  catMonthlyRent: number | null;
  dogMonthlyRent: number | null;
  truncatedUnitCount: number | null;
  hasMonthlyFeesSection: boolean;
  hasOneTimeFeesSection: boolean;
};

export function validateListingPrefs(
  prefs: unknown,
): prefs is ListingPrefs {
  if (!prefs || typeof prefs !== 'object') return false;
  const p = prefs as Record<string, unknown>;
  if (typeof p.target_beds !== 'number' || !Number.isFinite(p.target_beds)) {
    return false;
  }
  if (!p.pets || typeof p.pets !== 'object') return false;
  const pets = p.pets as Record<string, unknown>;
  return (
    typeof pets.cats === 'number' &&
    Number.isFinite(pets.cats) &&
    typeof pets.dogs === 'number' &&
    Number.isFinite(pets.dogs)
  );
}

export function parseSourceUrlHeader(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^source_url:\s*(https:\/\/\S+)/i);
    if (match) return match[1].trim();
    break;
  }
  return null;
}

export function splitDumpContent(content: string): {
  sourceUrl: string | null;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  let bodyStart = 0;
  let sourceUrl: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^source_url:\s*(https:\/\/\S+)/i);
    if (match) {
      sourceUrl = match[1].trim();
      bodyStart = i + 1;
      if (lines[bodyStart]?.trim() === '') bodyStart += 1;
    }
    break;
  }

  return {
    sourceUrl,
    body: lines.slice(bodyStart).join('\n'),
  };
}
