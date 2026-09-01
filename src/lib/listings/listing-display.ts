import {
  formatAmenities,
  formatMoney,
  formatNumber,
  formatSqft,
  formatListingMonthlyTotal,
  sumListingMonthlyTotal,
  sumListingMoveInTotal,
} from './format-attributes';
import {
  LISTING_COST_SECTION_LABELS,
  LISTING_FIELD_LABELS,
} from './field-labels';

export type ListingFact = {
  label: string;
  value: string;
  prewrap?: boolean;
  hint?: string;
};

export type ListingFactGroup = {
  title: string;
  facts: ListingFact[];
  /** Section title for assistive tech only (no visible heading). */
  srOnlyTitle?: boolean;
};

export type ListingDisplayInput = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  source_url?: string | null;
  photo_urls?: string[] | null;
  photo_url?: string | null;
  notes?: string | null;
  price_monthly?: number | null;
  deposit?: number | null;
  fees_monthly?: number | null;
  application_fees?: number | null;
  move_in_fees?: number | null;
  sqft?: number | null;
  beds?: number | null;
  baths?: number | null;
  pet_rent_monthly?: number | null;
  pet_deposit?: number | null;
  amenities?: string[] | null;
};

export type ListingDisplay = {
  title: string;
  address: string | null;
  phone: string | null;
  sourceUrl: string | null;
  monthlyTotal: string | null;
  moveInTotal: string | null;
  showMoveInDepositNote: boolean;
  photoUrls: string[];
  factGroups: ListingFactGroup[];
  hasFactSections: boolean;
};

function listingFacts(
  entries: Array<ListingFact | false | null | undefined>,
): ListingFact[] {
  return entries.filter(Boolean) as ListingFact[];
}

export function buildListingDisplay(
  listing: ListingDisplayInput,
  labels: typeof LISTING_FIELD_LABELS = LISTING_FIELD_LABELS,
  sectionLabels: typeof LISTING_COST_SECTION_LABELS = LISTING_COST_SECTION_LABELS,
): ListingDisplay {
  const photoUrls =
    listing.photo_urls && listing.photo_urls.length > 0
      ? listing.photo_urls
      : listing.photo_url
        ? [listing.photo_url]
        : [];

  const monthlyTotal = sumListingMonthlyTotal(listing);
  const moveInTotal = sumListingMoveInTotal(listing);

  const depositCostFacts = listingFacts([
    listing.deposit != null && {
      label: labels.deposit,
      value: formatMoney(listing.deposit),
    },
    listing.pet_deposit != null && {
      label: labels.petDeposit,
      value: formatMoney(listing.pet_deposit),
    },
  ]);

  const oneTimeCostFacts = listingFacts([
    listing.application_fees != null && {
      label: labels.applicationFees,
      value: formatMoney(listing.application_fees),
    },
    listing.move_in_fees != null && {
      label: labels.moveInFees,
      value: formatMoney(listing.move_in_fees),
    },
  ]);

  const monthlyCostFacts = listingFacts([
    listing.price_monthly != null && {
      label: labels.rentMonthly,
      value: formatMoney(listing.price_monthly),
    },
    listing.fees_monthly != null && {
      label: labels.feesMonthly,
      value: formatMoney(listing.fees_monthly),
    },
    listing.pet_rent_monthly != null && {
      label: labels.petMonthly,
      value: formatMoney(listing.pet_rent_monthly),
    },
  ]);

  const unitFacts = listingFacts([
    listing.beds != null && { label: labels.beds, value: formatNumber(listing.beds) },
    listing.baths != null && { label: labels.baths, value: formatNumber(listing.baths) },
    listing.sqft != null && { label: labels.sqft, value: formatSqft(listing.sqft) },
  ]);

  const otherFacts = listingFacts([
    (listing.amenities?.length ?? 0) > 0 && {
      label: labels.amenities,
      value: formatAmenities(listing.amenities),
    },
    listing.notes?.trim() && {
      label: labels.notes,
      value: listing.notes.trim(),
      prewrap: true,
    },
  ]);

  const factGroups: ListingFactGroup[] = [];
  if (unitFacts.length > 0 || otherFacts.length > 0) {
    factGroups.push({
      title: sectionLabels.attributes,
      facts: [...unitFacts, ...otherFacts],
      srOnlyTitle: true,
    });
  }
  if (depositCostFacts.length > 0) {
    factGroups.push({ title: sectionLabels.deposit, facts: depositCostFacts });
  }
  if (oneTimeCostFacts.length > 0) {
    factGroups.push({ title: sectionLabels.oneTimeFees, facts: oneTimeCostFacts });
  }
  if (monthlyCostFacts.length > 0) {
    factGroups.push({ title: sectionLabels.monthly, facts: monthlyCostFacts });
  }

  const showMoveInDepositNote =
    moveInTotal != null &&
    ((listing.deposit != null && listing.deposit > 0) ||
      (listing.pet_deposit != null && listing.pet_deposit > 0));

  return {
    title: listing.name?.trim() || 'Listing',
    address: listing.address?.trim() || null,
    phone: listing.phone?.trim() || null,
    sourceUrl: listing.source_url?.trim() || null,
    monthlyTotal: formatListingMonthlyTotal(listing),
    moveInTotal: moveInTotal != null ? formatMoney(moveInTotal) : null,
    showMoveInDepositNote,
    photoUrls,
    factGroups,
    hasFactSections: factGroups.length > 0,
  };
}
