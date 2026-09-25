import type { User } from '@supabase/supabase-js';
import { DEMO_DISPLAY_NAME, DEMO_USER_ID } from './constants';

/** Synthetic principal for locals only. Never written to auth.users. */
export function createSyntheticDemoUser(): User {
  const now = new Date().toISOString();
  return {
    id: DEMO_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: undefined,
    phone: undefined,
    app_metadata: { provider: 'demo', providers: ['demo'] },
    user_metadata: { display_name: DEMO_DISPLAY_NAME },
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}
