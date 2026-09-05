import { describe, expect, it } from 'vitest';
import { resolveAppointmentListingIds } from '../src/lib/tours/appointment-listing-ids';

describe('resolveAppointmentListingIds', () => {
  it('uses listing_ids when present and dedupes', () => {
    expect(
      resolveAppointmentListingIds({
        listing_id: 'ignore',
        listing_ids: ['a', ' a ', 'b', 'a', ''],
      }),
    ).toEqual(['a', 'b']);
  });

  it('falls back to listing_id', () => {
    expect(resolveAppointmentListingIds({ listing_id: ' solo ' })).toEqual(['solo']);
    expect(resolveAppointmentListingIds({})).toEqual([]);
  });
});
