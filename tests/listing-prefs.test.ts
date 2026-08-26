import { describe, expect, it } from 'vitest';
import {
  parseListingPrefsInput,
  validateListingPrefs,
} from '../src/lib/listings/listing-prefs';

describe('listing-prefs', () => {
  it('validates prefs shape', () => {
    expect(
      validateListingPrefs({ target_beds: 2, pets: { cats: 1, dogs: 1 } }),
    ).toBe(true);
    expect(validateListingPrefs({ target_beds: 0, pets: { cats: 0, dogs: 0 } })).toBe(
      false,
    );
  });

  it('parses form/API input', () => {
    const result = parseListingPrefsInput({
      target_beds: 2,
      pets: { cats: 1, dogs: 0 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prefs).toEqual({
      target_beds: 2,
      pets: { cats: 1, dogs: 0 },
    });
  });
});
