import { filterAmenities } from './amenities.ts';
import { average, mode, roundMoney } from './text.ts';
import type { ListingPrefs, ParsedListing, ZillowExtract } from './types.ts';

export function rollupZillowListing(
  extract: ZillowExtract,
  prefs: ListingPrefs,
): { listing: ParsedListing; warnings: string[] } {
  const warnings: string[] = [];
  const targetUnits = extract.units.filter((u) => u.beds === prefs.target_beds);

  if (targetUnits.length === 0) {
    warnings.push(
      `No ${prefs.target_beds}-bed units found in dump; unit metrics left null`,
    );
  }

  if (extract.truncatedUnitCount !== null) {
    warnings.push(
      `${prefs.target_beds}-bed table may be incomplete (Show ${extract.truncatedUnitCount} more units)`,
    );
  }

  if (!extract.hasMonthlyFeesSection) {
    warnings.push('Monthly rent/fees section not found in dump');
  }
  if (!extract.hasOneTimeFeesSection) {
    warnings.push('One-time fees section not found in dump');
  }

  const rents = targetUnits.map((u) => u.rent);
  const sqfts = targetUnits.map((u) => u.sqft);
  const baths = targetUnits.map((u) => u.baths);

  const feesMonthly =
    extract.requiredMonthlyFees.length > 0
      ? roundMoney(
          extract.requiredMonthlyFees.reduce((sum, fee) => sum + fee, 0),
        )
      : null;

  const petDeposit = sumPetFees(
    prefs.pets.cats,
    extract.catOneTimeFee,
    prefs.pets.dogs,
    extract.dogOneTimeFee,
  );
  const petRentMonthly = sumPetFees(
    prefs.pets.cats,
    extract.catMonthlyRent,
    prefs.pets.dogs,
    extract.dogMonthlyRent,
  );

  const amenities = filterAmenities(extract.rawAmenities);

  return {
    listing: {
      name: extract.name,
      address: extract.address,
      phone: extract.phone,
      photo_url: extract.photoCandidates[0] ?? null,
      beds: prefs.target_beds,
      baths: baths.length ? mode(baths) : null,
      sqft: sqfts.length ? Math.round(average(sqfts)!) : null,
      price_monthly: rents.length ? Math.round(average(rents)!) : null,
      fees_monthly: feesMonthly,
      deposit: extract.deposit,
      pet_deposit: petDeposit,
      pet_rent_monthly: petRentMonthly,
      amenities,
      notes: null,
    },
    warnings,
  };
}

function sumPetFees(
  cats: number,
  catFee: number | null,
  dogs: number,
  dogFee: number | null,
): number | null {
  let total = 0;
  let any = false;
  if (cats > 0 && catFee !== null) {
    total += cats * catFee;
    any = true;
  }
  if (dogs > 0 && dogFee !== null) {
    total += dogs * dogFee;
    any = true;
  }
  return any ? total : null;
}
