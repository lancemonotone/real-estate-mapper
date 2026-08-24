export type NestRole = 'owner' | 'member';

export type Profile = {
  id: string;
  display_name: string | null;
  ui_theme_id: string | null;
  created_at: string;
};

export type Nest = {
  id: string;
  name: string;
  invite_token_hash: string;
  created_at: string;
};

export type NestMember = {
  nest_id: string;
  user_id: string;
  role: NestRole;
  created_at: string;
};

export type Locale = {
  id: string;
  nest_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  center_label: string | null;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  locale_id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  source_url: string | null;
  photo_path: string | null;
  photo_url: string | null;
  appointment_at: string | null;
  notes: string | null;
  price_monthly: number | null;
  deposit: number | null;
  fees_monthly: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  pet_rent_monthly: number | null;
  pet_deposit: number | null;
  amenities: string[] | null;
  is_favorite: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TourDay = {
  id: string;
  locale_id: string;
  tour_date: string;
  label: string | null;
  encoded_polyline: string | null;
  route_signature: string | null;
  start_address: string | null;
  start_lat: number | null;
  start_lng: number | null;
  start_name: string | null;
  start_place_id: string | null;
  end_address: string | null;
  end_lat: number | null;
  end_lng: number | null;
  end_name: string | null;
  end_place_id: string | null;
  created_at: string;
};

export type TourStop = {
  id: string;
  tour_day_id: string;
  listing_id: string;
  is_start: boolean;
  sort_order: number | null;
  leg_duration_sec: number | null;
  leg_distance_m: number | null;
};

export type ProximityCriterionKind = 'place_type' | 'fixed_pin';

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';

export type ProximityResultStatus = 'ok' | 'needs_geocode' | 'no_place' | 'error';

export type ProximityCriterion = {
  id: string;
  locale_id: string;
  label: string;
  kind: ProximityCriterionKind;
  place_type_key: string | null;
  pin_lat: number | null;
  pin_lng: number | null;
  pin_place_id: string | null;
  pin_name: string | null;
  travel_mode: TravelMode;
  sort_order: number;
  created_at: string;
};

export type LocalePoi = {
  id: string;
  locale_id: string;
  place_type_key: string;
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  fetched_at: string;
};

export type ProximityResult = {
  id: string;
  listing_id: string;
  criterion_id: string;
  status: ProximityResultStatus;
  place_id: string | null;
  place_name: string | null;
  place_lat: number | null;
  place_lng: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  maps_url: string | null;
  error_message: string | null;
  locked: boolean;
  computed_at: string;
};

export type ListingPlace = {
  id: string;
  listing_id: string;
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  travel_mode: TravelMode;
  label: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  maps_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      nests: {
        Row: Nest;
        Insert: Partial<Nest> & { invite_token_hash: string };
        Update: Partial<Nest>;
      };
      nest_members: {
        Row: NestMember;
        Insert: Omit<NestMember, 'created_at'> & { created_at?: string };
        Update: Partial<NestMember>;
      };
      locales: {
        Row: Locale;
        Insert: Partial<Locale> & {
          nest_id: string;
          name: string;
          center_lat: number;
          center_lng: number;
          radius_m: number;
        };
        Update: Partial<Locale>;
      };
      listings: {
        Row: Listing;
        Insert: Partial<Listing> & { locale_id: string };
        Update: Partial<Listing>;
      };
      tour_days: {
        Row: TourDay;
        Insert: Partial<TourDay> & { locale_id: string; tour_date: string };
        Update: Partial<TourDay>;
      };
      tour_stops: {
        Row: TourStop;
        Insert: Partial<TourStop> & { tour_day_id: string; listing_id: string };
        Update: Partial<TourStop>;
      };
      proximity_criteria: {
        Row: ProximityCriterion;
        Insert: Partial<ProximityCriterion> & {
          locale_id: string;
          label: string;
          kind: ProximityCriterionKind;
          travel_mode: TravelMode;
        };
        Update: Partial<ProximityCriterion>;
      };
      locale_pois: {
        Row: LocalePoi;
        Insert: Partial<LocalePoi> & {
          locale_id: string;
          place_type_key: string;
          place_id: string;
          name: string;
          lat: number;
          lng: number;
        };
        Update: Partial<LocalePoi>;
      };
      proximity_results: {
        Row: ProximityResult;
        Insert: Partial<ProximityResult> & {
          listing_id: string;
          criterion_id: string;
          status: ProximityResultStatus;
        };
        Update: Partial<ProximityResult>;
      };
      listing_places: {
        Row: ListingPlace;
        Insert: Partial<ListingPlace> & {
          listing_id: string;
          place_id: string;
          name: string;
          lat: number;
          lng: number;
          travel_mode: TravelMode;
        };
        Update: Partial<ListingPlace>;
      };
    };
    Functions: {
      create_nest: {
        Args: { p_invite_token_hash: string };
        Returns: string;
      };
      nest_id_for_invite: {
        Args: { token_hash: string };
        Returns: string;
      };
    };
  };
};
