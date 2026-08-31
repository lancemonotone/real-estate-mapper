/// <reference types="astro/client" />

import type { User, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './lib/types/database';

declare namespace App {
  interface Locals {
    user?: User;
    supabase?: SupabaseClient<Database>;
    devHuntPassPreview?: boolean;
    profile?: Pick<
      Database['public']['Tables']['profiles']['Row'],
      'ui_theme_id' | 'ui_show_borders'
    > | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly SUPABASE_SECRET_KEY: string;
  readonly GOOGLE_MAPS_API_KEY: string;
  readonly PUBLIC_GOOGLE_MAPS_BROWSER_KEY: string;
  readonly PUBLIC_GOOGLE_MAPS_MAP_ID: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_DEV_TOOLS?: string;
  readonly DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
