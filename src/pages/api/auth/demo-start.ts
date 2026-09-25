import type { APIRoute } from 'astro';
import {
  DEMO_COOKIE_NAME,
  DEMO_SESSION_TTL_SECONDS,
} from '../../../lib/demo/constants';
import {
  getDemoSessionSecret,
  getDemoVisitorToken,
  requireDemoNestId,
} from '../../../lib/demo/nest';
import { signDemoCookie, tokensMatch } from '../../../lib/demo/session';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const expected = getDemoVisitorToken();
  if (!expected) {
    return Response.json(
      { ok: false, error: 'Demo entry is not available.' },
      { status: 401 },
    );
  }

  let token = '';
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
    } | null;
    token = typeof body?.token === 'string' ? body.token : '';
  } else {
    const form = await request.formData();
    token = String(form.get('token') ?? '');
  }

  if (!tokensMatch(expected, token)) {
    return Response.json(
      { ok: false, error: 'Demo entry is not available.' },
      { status: 401 },
    );
  }

  const sessionSecret = getDemoSessionSecret();
  if (!sessionSecret) {
    return Response.json(
      { ok: false, error: 'Demo entry is not configured.' },
      { status: 503 },
    );
  }

  let nestId: string;
  try {
    nestId = requireDemoNestId();
  } catch {
    return Response.json(
      { ok: false, error: 'Demo entry is not configured.' },
      { status: 503 },
    );
  }

  const exp = Math.floor(Date.now() / 1000) + DEMO_SESSION_TTL_SECONDS;
  const value = signDemoCookie({ nestId, exp }, sessionSecret);
  const secure = import.meta.env.PROD;

  cookies.set(DEMO_COOKIE_NAME, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: DEMO_SESSION_TTL_SECONDS,
  });

  return redirect('/app');
};
