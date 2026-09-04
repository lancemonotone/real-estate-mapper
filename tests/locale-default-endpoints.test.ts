import { describe, expect, it } from 'vitest';
import { tourDayEndpointPatchFromLocaleDefaults } from '../src/lib/tours/locale-default-endpoints';

const emptyDay = {
  start_address: null,
  start_lat: null,
  start_lng: null,
  start_name: null,
  start_place_id: null,
  end_address: null,
  end_lat: null,
  end_lng: null,
  end_name: null,
  end_place_id: null,
};

const localeDefaults = {
  default_start_address: 'Hotel',
  default_start_lat: 28.1,
  default_start_lng: -82.5,
  default_start_name: 'Hotel',
  default_start_place_id: 'p1',
  default_end_address: 'Hotel',
  default_end_lat: 28.1,
  default_end_lng: -82.5,
  default_end_name: 'Hotel',
  default_end_place_id: 'p1',
};

describe('tourDayEndpointPatchFromLocaleDefaults', () => {
  it('copies both sides when day is empty', () => {
    const patch = tourDayEndpointPatchFromLocaleDefaults(emptyDay, localeDefaults);
    expect(patch.start_lat).toBe(28.1);
    expect(patch.end_name).toBe('Hotel');
  });

  it('does not overwrite an existing day start', () => {
    const patch = tourDayEndpointPatchFromLocaleDefaults(
      {
        ...emptyDay,
        start_address: 'Cafe',
        start_lat: 28.2,
        start_lng: -82.6,
        start_name: 'Cafe',
        start_place_id: 'p2',
      },
      localeDefaults,
    );
    expect(patch.start_lat).toBeUndefined();
    expect(patch.end_lat).toBe(28.1);
  });
});
