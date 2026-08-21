export type WorkspaceRole = 'owner' | 'member';

export type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  invite_token_hash: string;
  created_at: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type Listing = {
  id: string;
  workspace_id: string;
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
  workspace_id: string;
  tour_date: string;
  label: string | null;
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
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      workspaces: {
        Row: Workspace;
        Insert: Partial<Workspace> & { invite_token_hash: string };
        Update: Partial<Workspace>;
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Omit<WorkspaceMember, 'created_at'> & { created_at?: string };
        Update: Partial<WorkspaceMember>;
      };
      listings: {
        Row: Listing;
        Insert: Partial<Listing> & { workspace_id: string };
        Update: Partial<Listing>;
      };
      tour_days: {
        Row: TourDay;
        Insert: Partial<TourDay> & { workspace_id: string; tour_date: string };
        Update: Partial<TourDay>;
      };
      tour_stops: {
        Row: TourStop;
        Insert: Partial<TourStop> & { tour_day_id: string; listing_id: string };
        Update: Partial<TourStop>;
      };
    };
  };
};
