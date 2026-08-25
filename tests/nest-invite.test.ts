import { describe, expect, it } from 'vitest';
import { isInviteRedirect } from '../src/lib/supabase/nest';

describe('isInviteRedirect', () => {
  it('matches invite paths', () => {
    expect(isInviteRedirect('/invite/abc123')).toBe(true);
  });

  it('rejects non-invite paths', () => {
    expect(isInviteRedirect('/app')).toBe(false);
    expect(isInviteRedirect('/login?redirect=%2Finvite%2Fx')).toBe(false);
  });
});
