export type PlaceTypeKey =
  | 'beach'
  | 'park'
  | 'grocery'
  | 'restaurant'
  | 'school'
  | 'gym'
  | 'transit';

export type PlaceTypeStrategy =
  | { kind: 'nearby'; includedTypes: string[] }
  | { kind: 'text'; textQuery: string };

export const PLACE_TYPE_CATALOG: Record<
  PlaceTypeKey,
  { label: string; strategy: PlaceTypeStrategy }
> = {
  beach: { label: 'Beach', strategy: { kind: 'nearby', includedTypes: ['beach'] } },
  park: { label: 'Park', strategy: { kind: 'nearby', includedTypes: ['park'] } },
  grocery: {
    label: 'Grocery',
    strategy: { kind: 'nearby', includedTypes: ['grocery_store'] },
  },
  restaurant: {
    label: 'Restaurant',
    strategy: { kind: 'nearby', includedTypes: ['restaurant'] },
  },
  school: {
    label: 'School',
    strategy: { kind: 'nearby', includedTypes: ['school'] },
  },
  gym: { label: 'Gym', strategy: { kind: 'nearby', includedTypes: ['gym'] } },
  transit: {
    label: 'Transit station',
    strategy: { kind: 'nearby', includedTypes: ['transit_station'] },
  },
};

export const PROXIMITY_SHORTLIST_N = 5;

/** How many routed candidates to return for user choice (listing explore). */
export const PROXIMITY_CHOICE_N = 3;

export type PoiCandidate = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};
