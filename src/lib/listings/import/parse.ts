import { rollupZillowListing } from './rollup.ts';
import type { ListingPrefs, ParseResult } from './types.ts';
import {
  splitDumpContent,
  validateListingPrefs,
} from './types.ts';
import { extractZillow, isZillowDump } from './zillow.ts';
import { htmlToText } from './text.ts';

export function parseListingDump(
  content: string,
  prefs: ListingPrefs,
  options?: { requireSourceUrl?: boolean },
): ParseResult {
  if (!validateListingPrefs(prefs)) {
    return { ok: false, error: 'invalid_listing_prefs' };
  }

  const { sourceUrl, body } = splitDumpContent(content);
  const requireSourceUrl = options?.requireSourceUrl ?? true;

  if (requireSourceUrl && !sourceUrl) {
    return { ok: false, error: 'missing_source_url' };
  }

  if (!body.trim()) {
    return { ok: false, error: 'empty_dump_body' };
  }

  const text = htmlToText(body);
  if (!isZillowDump(body, text)) {
    return { ok: false, error: 'unsupported_source' };
  }

  const extract = extractZillow(body);
  const { listing, warnings } = rollupZillowListing(extract, prefs);

  if (!listing.name) {
    warnings.push('Property name not found in dump');
  }
  if (!listing.address) {
    warnings.push('Address not found in dump');
  }

  return {
    ok: true,
    source: 'zillow',
    source_url: sourceUrl ?? '',
    listing,
    warnings,
    photo_candidates: extract.photoCandidates,
  };
}

export {
  splitDumpContent,
  validateListingPrefs,
} from './types.ts';
