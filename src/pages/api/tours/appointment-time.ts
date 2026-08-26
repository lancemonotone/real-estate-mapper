import type { APIRoute } from 'astro';
import { appointmentTimeToMinutes } from '../../../lib/tours/appointment-order';
import { optimizeTourDay } from '../../../lib/tours/optimize-tour-day';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase =
    locals.supabase ?? createSupabaseServerClient(request, cookies);
  const user =
    locals.user ??
    (await supabase.auth.getUser()).data.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = (await request.json()) as {
    tour_day_id?: string;
    listing_id?: string;
    appointment_time?: string | null;
  };

  const tourDayId = body.tour_day_id?.trim();
  const listingId = body.listing_id?.trim();
  if (!tourDayId || !listingId) {
    return new Response(
      JSON.stringify({ error: 'tour_day_id and listing_id required' }),
      { status: 400 },
    );
  }

  let appointmentTime: string | null = null;
  if (body.appointment_time != null && String(body.appointment_time).trim() !== '') {
    const raw = String(body.appointment_time).trim();
    if (appointmentTimeToMinutes(raw) == null) {
      return new Response(
        JSON.stringify({ error: 'appointment_time must be HH:MM or HH:MM:SS' }),
        { status: 400 },
      );
    }
    // Store as HH:MM:SS for Postgres time
    appointmentTime = raw.length === 5 ? `${raw}:00` : raw;
  }

  const { data: stop, error: stopError } = await supabase
    .from('tour_stops')
    .select('listing_id')
    .eq('tour_day_id', tourDayId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (stopError) {
    return new Response(JSON.stringify({ error: stopError.message }), { status: 500 });
  }
  if (!stop) {
    return new Response(JSON.stringify({ error: 'Stop not found' }), { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('tour_stops')
    .update({ appointment_time: appointmentTime })
    .eq('tour_day_id', tourDayId)
    .eq('listing_id', listingId);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  const opt = await optimizeTourDay(supabase, tourDayId);
  return new Response(
    JSON.stringify({
      ok: true,
      optimized: opt.ok,
      optimizeError: opt.ok ? undefined : opt.error,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
