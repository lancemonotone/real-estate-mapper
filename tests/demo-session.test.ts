import { describe, expect, it } from 'vitest';
import {
  signDemoCookie,
  tokensMatch,
  verifyDemoCookie,
} from '../src/lib/demo/session';

describe('tokensMatch', () => {
  it('rejects empty expected', () => {
    expect(tokensMatch('', 'abc')).toBe(false);
  });
  it('accepts equal tokens', () => {
    expect(tokensMatch('secret-token', 'secret-token')).toBe(true);
  });
  it('rejects mismatched tokens', () => {
    expect(tokensMatch('secret-token', 'other')).toBe(false);
  });
});

describe('demo cookie', () => {
  const secret = 'test-session-secret-at-least-16';
  it('round-trips nestId', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const raw = signDemoCookie(
      { nestId: '571e710b-10a2-412f-9ddb-740923168397', exp },
      secret,
    );
    const parsed = verifyDemoCookie(raw, secret);
    expect(parsed?.nestId).toBe('571e710b-10a2-412f-9ddb-740923168397');
  });
  it('rejects tampered payload', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const raw = signDemoCookie(
      { nestId: '571e710b-10a2-412f-9ddb-740923168397', exp },
      secret,
    );
    expect(verifyDemoCookie(raw + 'x', secret)).toBeNull();
  });
  it('rejects expired cookie', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const raw = signDemoCookie(
      { nestId: '571e710b-10a2-412f-9ddb-740923168397', exp },
      secret,
    );
    expect(verifyDemoCookie(raw, secret)).toBeNull();
  });
});
