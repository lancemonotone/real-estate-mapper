import type { APIRoute } from 'astro';
import {
  applyCalendarAction,
  type CalendarAction,
  type ConflictMode,
} from '../../../lib/tours/calendar-action';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getLocaleForNestMember } from '../../../lib/supabase/nest';

function isConflictMode(v: unknown): v is ConflictMode {
  return v === 'merge' || v === 'replace';
}

function parseAction(raw: unknown): CalendarAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const type = a.type;
  if (type === 'assign') {
    if (!Array.isArray(a.listingIds) || typeof a.tourDate !== 'string') return null;
    const mode = a.mode;
    if (mode !== undefined && !isConflictMode(mode)) return null;
    return {
      type: 'assign',
      listingIds: a.listingIds.map(String),
      tourDate: a.tourDate,
      mode: isConflictMode(mode) ? mode : undefined,
    };
  }
  if (type === 'unassign') {
    if (!Array.isArray(a.listingIds) || typeof a.tourDayId !== 'string') return null;
    return {
      type: 'unassign',
      listingIds: a.listingIds.map(String),
      tourDayId: a.tourDayId,
    };
  }
  if (type === 'moveDay') {
    if (typeof a.fromDate !== 'string' || typeof a.toDate !== 'string') return null;
    const mode = a.mode;
    if (mode !== undefined && !isConflictMode(mode)) return null;
    return {
      type: 'moveDay',
      fromDate: a.fromDate,
      toDate: a.toDate,
      mode: isConflictMode(mode) ? mode : undefined,
    };
  }
  if (type === 'reorder') {
    if (!Array.isArray(a.listingIdsInOrder) || typeof a.tourDayId !== 'string') return null;
    return {
      type: 'reorder',
      tourDayId: a.tourDayId,
      listingIdsInOrder: a.listingIdsInOrder.map(String),
    };
  }
  return null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json()) as { localeId?: string; action?: unknown };
  if (!body.localeId) {
    return Response.json({ error: 'localeId required' }, { status: 400 });
  }

  const action = parseAction(body.action);
  if (!action) {
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  const locale = await getLocaleForNestMember(supabase, body.localeId);
  if (!locale) return Response.json({ error: 'Locale not found' }, { status: 404 });

  const result = await applyCalendarAction(supabase, body.localeId, action, { userId: user.id });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
};
