import { textQueryCacheKey } from '../proximity/text-query';
import type { ListingPageSurfaceCompareRow } from './listing-page-surface-types';

export function compareRowPlaceTypeKey(row: ListingPageSurfaceCompareRow): string {
  if (row.kind === 'place_type') return row.placeTypeKey ?? '';
  if (row.kind === 'text_query' && row.textQuery) return textQueryCacheKey(row.textQuery);
  return '';
}
