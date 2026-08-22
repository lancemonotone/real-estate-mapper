export type NestRole = 'owner' | 'member';

export type Profile = {
  id: string;
  display_name: string | null;
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
  lat: number | null;
  lng: number | null;
  source_url: string | null;
  photo_path: string | null;
  photo_url: string | null;
  appointment_at: string | null;
  notes: string | null;
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
  start_address: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_address: string | null;
  end_lat: number | null;
  end_lng: number | null;
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
