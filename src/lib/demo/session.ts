import { createHmac, timingSafeEqual } from 'node:crypto';

export type DemoCookiePayload = {
  nestId: string;
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function tokensMatch(expected: string, provided: string): boolean {
  if (!expected) return false;
  return safeEqualHex(expected, provided);
}

export function signDemoCookie(
  payload: DemoCookiePayload,
  secret: string,
): string {
  const body = base64UrlEncode(
    JSON.stringify({ v: 1, nestId: payload.nestId, exp: payload.exp }),
  );
  return `${body}.${signBody(body, secret)}`;
}

export function verifyDemoCookie(
  value: string,
  secret: string,
): DemoCookiePayload | null {
  if (!value || !secret) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!safeEqualHex(signBody(body, secret), sig)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(body));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (typeof record.nestId !== 'string' || !record.nestId) return null;
  if (typeof record.exp !== 'number' || !Number.isFinite(record.exp)) return null;
  if (record.exp < Math.floor(Date.now() / 1000)) return null;
  return { nestId: record.nestId, exp: record.exp };
}
