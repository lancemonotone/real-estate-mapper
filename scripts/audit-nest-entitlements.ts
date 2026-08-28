import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): void {
  const text = readFileSync('.env', 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function isPro(passExpiresAt: string | null): boolean {
  if (!passExpiresAt) return false;
  return new Date(passExpiresAt) > new Date();
}

function oldestIds<T extends { id: string; created_at: string }>(
  rows: T[],
  limit: number | null,
): Set<string> {
  if (limit === null || rows.length <= limit) return new Set(rows.map((r) => r.id));
  return new Set(
    [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, limit).map((r) => r.id),
  );
}

loadEnv();

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const FREE = { locales: 1, listings: 12, tourDays: 3, photos: 1 };

const { data: nests, error: nestError } = await supabase
  .from('nests')
  .select(
    'id, name, pass_expires_at, proximity_demo_used_at, created_at',
  )
  .order('created_at', { ascending: true });

if (nestError) {
  console.error(nestError.message);
  process.exit(1);
}

for (const nest of nests ?? []) {
  const plan = isPro(nest.pass_expires_at) ? 'pro' : 'free';

  const { data: locales } = await supabase
    .from('locales')
    .select('id, name, created_at')
    .eq('nest_id', nest.id)
    .order('created_at', { ascending: true });

  const visibleLocaleIds = oldestIds(locales ?? [], plan === 'free' ? FREE.locales : 5);

  const localeIds = (locales ?? []).map((l) => l.id);
  let listings: Array<{
    id: string;
    locale_id: string;
    name: string | null;
    created_at: string;
    archived_at: string | null;
    photo_urls: string[];
  }> = [];

  if (localeIds.length > 0) {
    const { data } = await supabase
      .from('listings')
      .select('id, locale_id, name, created_at, archived_at, photo_urls')
      .in('locale_id', localeIds)
      .order('created_at', { ascending: true });
    listings = data ?? [];
  }

  const activeInVisibleLocales = listings.filter(
    (l) => !l.archived_at && visibleLocaleIds.has(l.locale_id),
  );
  const visibleListingIds = oldestIds(
    activeInVisibleLocales,
    plan === 'free' ? FREE.listings : 100,
  );

  let tourDays: Array<{
    id: string;
    locale_id: string;
    tour_date: string;
    created_at: string;
    stop_count: number;
  }> = [];

  if (localeIds.length > 0) {
    const { data: days } = await supabase
      .from('tour_days')
      .select('id, locale_id, tour_date, created_at')
      .in('locale_id', localeIds)
      .order('created_at', { ascending: true });

    if (days?.length) {
      const dayIds = days.map((d) => d.id);
      const { data: stops } = await supabase
        .from('tour_stops')
        .select('tour_day_id')
        .in('tour_day_id', dayIds);

      const counts = new Map<string, number>();
      for (const stop of stops ?? []) {
        counts.set(stop.tour_day_id, (counts.get(stop.tour_day_id) ?? 0) + 1);
      }

      tourDays = days.map((day) => ({
        ...day,
        stop_count: counts.get(day.id) ?? 0,
      }));
    }
  }

  const withStops = tourDays.filter(
    (d) => d.stop_count > 0 && visibleLocaleIds.has(d.locale_id),
  );
  const visibleTourDayIds = oldestIds(
    withStops,
    plan === 'free' ? FREE.tourDays : null,
  );

  const activeListings = listings.filter((l) => !l.archived_at);
  const activeVisibleCount = activeInVisibleLocales.filter((l) =>
    visibleListingIds.has(l.id),
  ).length;

  console.log(
    JSON.stringify(
      {
        nest: { id: nest.id, name: nest.name },
        plan,
        pass_expires_at: nest.pass_expires_at,
        proximity_demo_used: Boolean(nest.proximity_demo_used_at),
        totals: {
          locales: locales?.length ?? 0,
          active_listings: activeListings.length,
          tour_days_with_stops: tourDays.filter((d) => d.stop_count > 0).length,
        },
        visible_counts: {
          locales: visibleLocaleIds.size,
          listings: visibleListingIds.size,
          tour_days: visibleTourDayIds.size,
        },
        hidden: {
          locales: (locales?.length ?? 0) - visibleLocaleIds.size,
          listings:
            activeInVisibleLocales.length - visibleListingIds.size,
          tour_days: withStops.length - visibleTourDayIds.size,
        },
        write_gates_would_block: {
          add_listing: plan === 'free' && activeVisibleCount >= FREE.listings,
          create_locale: plan === 'free' && (locales?.length ?? 0) >= FREE.locales,
          new_tour_day:
            plan === 'free' && withStops.length >= FREE.tourDays,
          proximity_compute:
            plan === 'free' && Boolean(nest.proximity_demo_used_at),
        },
        visible_locales: (locales ?? [])
          .filter((l) => visibleLocaleIds.has(l.id))
          .map((l) => l.name),
        visible_listings: activeInVisibleLocales
          .filter((l) => visibleListingIds.has(l.id))
          .map((l) => l.name ?? l.id),
        hidden_listings: activeInVisibleLocales
          .filter((l) => !visibleListingIds.has(l.id))
          .map((l) => l.name ?? l.id),
        hidden_locales: (locales ?? [])
          .filter((l) => !visibleLocaleIds.has(l.id))
          .map((l) => l.name),
        hidden_tour_days: withStops
          .filter((d) => !visibleTourDayIds.has(d.id))
          .map((d) => d.tour_date),
        photos_trimmed: listings
          .filter((l) => visibleListingIds.has(l.id) && (l.photo_urls?.length ?? 0) > FREE.photos)
          .map((l) => ({
            name: l.name,
            total: l.photo_urls.length,
            shown: FREE.photos,
          })),
      },
      null,
      2,
    ),
  );
}
