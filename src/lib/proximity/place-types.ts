export type PlaceTypeKey =
  | 'beach'
  | 'park'
  | 'grocery'
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
  beach: { label: 'Beach', strategy: { kind: 'text', textQuery: 'beach' } },
  park: { label: 'Park', strategy: { kind: 'nearby', includedTypes: ['park'] } },
  grocery: {
    label: 'Grocery',
    strategy: { kind: 'nearby', includedTypes: ['grocery_store'] },
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

export type PoiCandidate = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};
