import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { filterAmenities } from '../src/lib/listings/import/amenities';
import { parseListingDump, validateListingPrefs } from '../src/lib/listings/import/parse';
import { mode, parseMoney } from '../src/lib/listings/import/text';
import { rollupZillowListing } from '../src/lib/listings/import/rollup';
import { extractZillow } from '../src/lib/listings/import/zillow';

const PREFS = { target_beds: 2, pets: { cats: 1, dogs: 1 } };

describe('validateListingPrefs', () => {
  it('accepts valid prefs', () => {
    expect(validateListingPrefs(PREFS)).toBe(true);
  });

  it('rejects incomplete prefs', () => {
    expect(validateListingPrefs({ target_beds: 2 })).toBe(false);
    expect(validateListingPrefs(null)).toBe(false);
  });
});

describe('parseMoney / mode', () => {
  it('parses comma amounts', () => {
    expect(parseMoney('1,861')).toBe(1861);
  });

  it('picks bath mode', () => {
    expect(mode([2, 2, 2, 2.5, 2.5])).toBe(2);
  });
});

describe('filterAmenities', () => {
  it('drops baseline appliances', () => {
    const out = filterAmenities([
      'Club House',
      'Refrigerator',
      'Swimming Pool: Swimming Pools',
      'In Unit: Washer And Dryer',
    ]);
    expect(out).toContain('Clubhouse');
    expect(out).toContain('Swimming Pool');
    expect(out).toContain('In-Unit Washer/Dryer');
    expect(out.some((a) => /refrigerator/i.test(a))).toBe(false);
  });

  it('keeps pool, spa, and leisure amenities', () => {
    const out = filterAmenities([
      'Swimming Pool: Heated Pool and Spa',
      'Hot Tub',
      'Jacuzzi',
      'Sauna',
      'Fire Pit',
      'Pickleball Court',
      'Lazy River',
    ]);
    expect(out).toContain('Swimming Pool');
    expect(out).toContain('Hot Tub');
    expect(out).toContain('Jacuzzi');
    expect(out).toContain('Sauna');
    expect(out).toContain('Fire Pit');
    expect(out).toContain('Pickleball');
    expect(out).toContain('Lazy River');
  });
});

describe('parseListingDump', () => {
  it('requires source_url by default', () => {
    const result = parseListingDump('<div>Building Amenities Club House</div>', PREFS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('missing_source_url');
  });

  it('parses MacAlpine dump when present', () => {
    let content: string;
    try {
      content = readFileSync('_listings/listing.txt', 'utf8');
    } catch {
      return;
    }
    if (!content.includes('MacAlpine')) return;

    const withHeader = content.startsWith('source_url:')
      ? content
      : `source_url: https://www.zillow.com/apartments/dunedin-fl/macalpine-place/5Xhz67/\n\n${content}`;

    const result = parseListingDump(withHeader, PREFS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.listing.name).toContain('MacAlpine');
    expect(result.listing.beds).toBe(2);
    expect(result.listing.price_monthly).toBeGreaterThan(1500);
    expect(result.listing.pet_deposit).toBe(700);
    expect(result.listing.pet_rent_monthly).toBe(70);
    expect(result.listing.amenities.length).toBeGreaterThan(5);
  });
});

describe('extractZillow + rollup', () => {
  it('extracts units from inline table text', () => {
    const html = `
      source_url ignored here
      <h1 data-test-id="bdp-building-title">Test Place</h1>
      152 Macalpine Way, Dunedin, FL 34698
      (813) 544-5890
      Monthly rent, fees & charges Required Package Lockers $10 - $15 Pest Control $3 Trash $33
      One-time fees & charges Required Deposit $400 Pet Fee (Cat) ($350) $350 Pet Fee (Dog) ($350) $350
      Building Amenities Club House Swimming Pool: Swimming Pools Pet Park
      Pet essentials Monthly dog rent $35 One-time dog fee $350 Monthly cat rent $35 One-time cat fee $350
      26-203 2 bd, 2 ba 4 photos 1,173 Oct 8 Message $1,528
      2-106 2 bd, 2 ba 4 photos 1,173 Oct 9 Message $1,621
    `;
    const extract = extractZillow(html);
    expect(extract.name).toBe('Test Place');
    expect(extract.units).toHaveLength(2);
    const { listing } = rollupZillowListing(extract, PREFS);
    expect(listing.price_monthly).toBe(1575);
    expect(listing.fees_monthly).toBe(48.5);
    expect(listing.deposit).toBe(400);
    expect(listing.pet_deposit).toBe(700);
  });

  it('extracts compact unit rows without Message/Take tour', () => {
    const html = `
      <h1 data-test-id="bdp-building-title">Chesapeake</h1>
      2307 Cumberland Cir, Clearwater, FL 33763
      One-time fees & charges Required Security deposit $200
      2306-106 2 bd, 2 ba 911 Aug 29 $1,704
      2269-2801 2 bd, 2 ba 911 Now $1,714
    `;
    const extract = extractZillow(html);
    expect(extract.address).toContain('Cumberland Cir');
    expect(extract.units).toHaveLength(2);
    const { listing } = rollupZillowListing(extract, PREFS);
    expect(listing.price_monthly).toBe(1709);
    expect(listing.sqft).toBe(911);
  });
});
