import {
  DEMO_READONLY_CODE,
  DEMO_READONLY_MESSAGE,
} from './constants';

export function forbidDemoMutation(locals: App.Locals): Response | null {
  if (!locals.isDemo) return null;
  return Response.json(
    {
      ok: false,
      error: DEMO_READONLY_MESSAGE,
      code: DEMO_READONLY_CODE,
    },
    { status: 403 },
  );
}
