/** User-facing labels for listing cost and attribute fields. */

export const LISTING_FIELD_LABELS = {
  totalMonthly: 'Total/mo',
  totalMoveIn: 'Move-in',
  deposit: 'Deposit',
  petDeposit: 'Pet dep',
  applicationFees: 'App fee',
  moveInFees: 'Move fee',
  rentMonthly: 'Rent/mo',
  feesMonthly: 'Fees/mo',
  petMonthly: 'Pet/mo',
  beds: 'Beds',
  baths: 'Baths',
  sqft: 'Sqft',
  amenities: 'Amenities',
  notes: 'Notes',
} as const;

export const LISTING_COST_SECTION_LABELS = {
  deposit: 'Deposit',
  oneTimeFees: 'One-time fees',
  monthly: 'Monthly',
  attributes: 'Attributes',
} as const;
