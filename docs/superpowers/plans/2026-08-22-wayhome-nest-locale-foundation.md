# Wayhome Nest + Locale Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the shared household to **Nest**, introduce **Locale** (center + radius) as the scope for listings and tour days, migrate existing data, and rewire the app so all day-to-day work is Locale-scoped under a Nest.

**Architecture:** One SQL migration renames `workspaces` → `nests`, adds `locales`, backfills one default Locale per Nest, and moves `listings` / `tour_days` to `locale_id`. Pure TS helpers compute center/radius from pins and expand radius when a listing falls outside. Astro pages move under `/app/locales/[localeId]/…`; Nest home at `/app` lists Locales. Product copy uses Wayhome / Nest / Locale.

**Tech Stack:** Astro SSR, Supabase Postgres + RLS, TypeScript, Vitest (existing patterns).

**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-nest-locale-proximity-design.md`  
**Follow-on plans:** `2026-08-22-wayhome-proximity-engine.md`, `2026-08-22-wayhome-proximity-ui.md`

## Global Constraints

- Fail Fast: no invented coordinates, radii, or default Locale center when no geocoded listings exist — require explicit Locale setup.
- No dual path: after migration, listings/tours are Locale-scoped only (no `workspace_id` on those tables).
- Nest membership (invite) unchanged in meaning; RLS via Nest membership for all Locale rows.
- Branch from `staging`; feature branch `feature/plan-nest-locale-foundation`.
- Do not commit secrets (`.env`).
- Do not implement proximity POI/Compare UI in this plan.

---

## File structure

```
supabase/migrations/
  20260822150000_nest_locale_foundation.sql   # rename + locales + backfill
src/lib/
  geo/
    locale-area.ts                            # center/radius from pins; expand
  supabase/
    workspace.ts → nest.ts                    # rename module + Locale helpers
  types/database.ts                           # Nest, Locale, locale_id fields
src/pages/app/
  index.astro                                 # Nest home: list Locales
  locales/
    new.astro                                 # create Locale
    [localeId]/
      index.astro                             # Locale hub
      listings/…                              # moved from /app/listings
      unscheduled.astro
      tours/…
  settings.astro                              # Nest invite (unchanged path OK)
src/pages/api/
  locales/create.ts
  listings/*                                  # require locale_id
  tours/*                                     # require locale_id via tour_days
tests/
  locale-area.test.ts
```

---

### Task 1: Locale area pure helpers (TDD)

**Files:**
- Create: `src/lib/geo/locale-area.ts`
- Test: `tests/locale-area.test.ts`

**Interfaces:**
- Consumes: `haversineMeters` from `src/lib/geo/haversine.ts`
- Produces:
  - `type LatLng = { lat: number; lng: number }` (re-export or import from haversine)
  - `centerFromPoints(points: LatLng[]): LatLng` — arithmetic mean of lat/lng; throws if `points.length === 0`
  - `radiusMetersToCover(center: LatLng, points: LatLng[], paddingM: number): number` — max haversine(center, p) + padding; throws if empty
  - `expandRadiusToInclude(center: LatLng, radiusM: number, point: LatLng, paddingM: number): number` — if point within radius return `radiusM`; else `haversine(center, point) + paddingM`
  - `DEFAULT_LOCALE_PADDING_M = 1000`
  - `DEFAULT_NEW_LOCALE_RADIUS_M = 25000`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  centerFromPoints,
  expandRadiusToInclude,
  radiusMetersToCover,
} from '../src/lib/geo/locale-area';

describe('locale-area', () => {
  it('centerFromPoints averages coordinates', () => {
    expect(
      centerFromPoints([
        { lat: 0, lng: 0 },
        { lat: 2, lng: 4 },
      ]),
    ).toEqual({ lat: 1, lng: 2 });
  });

  it('centerFromPoints throws on empty', () => {
    expect(() => centerFromPoints([])).toThrow(/empty/i);
  });

  it('radiusMetersToCover includes farthest point plus padding', () => {
    const center = { lat: 0, lng: 0 };
    const r = radiusMetersToCover(center, [{ lat: 0, lng: 0.01 }], 1000);
    expect(r).toBeGreaterThan(1000);
  });

  it('expandRadiusToInclude grows only when outside', () => {
    const center = { lat: 26.7, lng: -80.0 };
    expect(expandRadiusToInclude(center, 5000, center, 1000)).toBe(5000);
    const grown = expandRadiusToInclude(
      center,
      100,
      { lat: 26.8, lng: -80.0 },
      1000,
    );
    expect(grown).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/locale-area.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
import { haversineMeters, type LatLng } from './haversine';

export type { LatLng };

export const DEFAULT_LOCALE_PADDING_M = 1000;
export const DEFAULT_NEW_LOCALE_RADIUS_M = 25_000;

export function centerFromPoints(points: LatLng[]): LatLng {
  if (points.length === 0) throw new Error('centerFromPoints: empty points');
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

export function radiusMetersToCover(
  center: LatLng,
  points: LatLng[],
  paddingM: number,
): number {
  if (points.length === 0) throw new Error('radiusMetersToCover: empty points');
  const max = Math.max(...points.map((p) => haversineMeters(center, p)));
  return max + paddingM;
}

export function expandRadiusToInclude(
  center: LatLng,
  radiusM: number,
  point: LatLng,
  paddingM: number,
): number {
  const d = haversineMeters(center, point);
  if (d <= radiusM) return radiusM;
  return d + paddingM;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/locale-area.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/locale-area.test.ts src/lib/geo/locale-area.ts
git commit -m "feat: add locale area center and radius helpers"
```

---

### Task 2: Database migration — Nest + Locale

**Files:**
- Create: `supabase/migrations/20260822150000_nest_locale_foundation.sql`

**Interfaces:**
- Produces tables/columns matching `Database` types in Task 3
- Produces RPC: `create_household_nest(p_invite_token_hash text) returns uuid` (replaces `create_household_workspace`)
- Produces: `is_nest_member(nest_id uuid) returns boolean`
- Produces: `nest_id_for_invite(token_hash text) returns uuid`

- [ ] **Step 1: Write migration SQL** (apply via Supabase SQL editor / `supabase db push` as this repo does)

```sql
-- Wayhome: workspaces → nests; add locales; scope listings & tour_days

-- 1) Rename membership helper
create or replace function public.is_nest_member(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = n
      and m.user_id = auth.uid()
  );
$$;

-- Keep old name as wrapper during rename (dropped after table rename)
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_nest_member(ws);
$$;

-- 2) Locales (FK to workspaces id until rename)
create table public.locales (
  id uuid primary key default gen_random_uuid(),
  nest_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m double precision not null check (radius_m > 0),
  center_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locales_nest_id_idx on public.locales (nest_id);

alter table public.locales enable row level security;

create policy "locales_all_member"
  on public.locales for all
  using (public.is_nest_member(nest_id))
  with check (public.is_nest_member(nest_id));

-- 3) Backfill one Locale per workspace.
-- Center = avg of geocoded listing coords, or (0,0) if none (UI treats as needs setup).
-- Radius = 25000m; Task 6 expands as listings are saved/geocoded.
insert into public.locales (nest_id, name, center_lat, center_lng, radius_m)
select
  w.id,
  coalesce(nullif(trim(w.name), ''), 'Household') || ' Locale',
  coalesce((
    select avg(l.lat) from public.listings l
    where l.workspace_id = w.id and l.lat is not null and l.lng is not null
  ), 0),
  coalesce((
    select avg(l.lng) from public.listings l
    where l.workspace_id = w.id and l.lat is not null and l.lng is not null
  ), 0),
  25000
from public.workspaces w;

-- 4) listings.locale_id
alter table public.listings
  add column locale_id uuid references public.locales (id) on delete cascade;

update public.listings li
set locale_id = loc.id
from public.locales loc
where loc.nest_id = li.workspace_id;

alter table public.listings
  alter column locale_id set not null;

alter table public.listings drop constraint listings_workspace_id_fkey;
drop index if exists listings_workspace_id_idx;
alter table public.listings drop column workspace_id;
create index listings_locale_id_idx on public.listings (locale_id);

drop policy if exists "listings_all_member" on public.listings;
create policy "listings_all_member"
  on public.listings for all
  using (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  );

-- 5) tour_days.locale_id
alter table public.tour_days
  add column locale_id uuid references public.locales (id) on delete cascade;

update public.tour_days td
set locale_id = loc.id
from public.locales loc
where loc.nest_id = td.workspace_id;

alter table public.tour_days alter column locale_id set not null;

alter table public.tour_days drop constraint tour_days_workspace_id_tour_date_key;
alter table public.tour_days drop constraint tour_days_workspace_id_fkey;
drop index if exists tour_days_workspace_id_idx;
alter table public.tour_days drop column workspace_id;
create unique index tour_days_locale_id_tour_date_key on public.tour_days (locale_id, tour_date);
create index tour_days_locale_id_idx on public.tour_days (locale_id);

drop policy if exists "tour_days_all_member" on public.tour_days;
create policy "tour_days_all_member"
  on public.tour_days for all
  using (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1 from public.locales loc
      where loc.id = locale_id and public.is_nest_member(loc.nest_id)
    )
  );

drop policy if exists "tour_stops_all_member" on public.tour_stops;
create policy "tour_stops_all_member"
  on public.tour_stops for all
  using (
    exists (
      select 1
      from public.tour_days td
      join public.locales loc on loc.id = td.locale_id
      where td.id = tour_day_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1
      from public.tour_days td
      join public.locales loc on loc.id = td.locale_id
      where td.id = tour_day_id and public.is_nest_member(loc.nest_id)
    )
  );

-- 6) Rename workspaces → nests, workspace_members → nest_members
alter table public.workspace_members rename column workspace_id to nest_id;
alter table public.workspace_members rename to nest_members;
alter table public.workspaces rename to nests;

alter table public.locales drop constraint locales_nest_id_fkey;
alter table public.locales
  add constraint locales_nest_id_fkey
  foreign key (nest_id) references public.nests (id) on delete cascade;

create or replace function public.is_nest_member(n uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nest_members m
    where m.nest_id = n and m.user_id = auth.uid()
  );
$$;

drop function if exists public.is_workspace_member(uuid);

create or replace function public.nest_id_for_invite(token_hash text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.nests where invite_token_hash = token_hash limit 1;
$$;

drop function if exists public.workspace_id_for_invite(text);
grant execute on function public.nest_id_for_invite(text) to authenticated;

-- Recreate nest policies (names)
drop policy if exists "workspaces_select_member" on public.nests;
drop policy if exists "workspaces_insert_authenticated" on public.nests;
drop policy if exists "workspaces_update_member" on public.nests;
create policy "nests_select_member"
  on public.nests for select using (public.is_nest_member(id));
create policy "nests_insert_authenticated"
  on public.nests for insert to authenticated with check (true);
create policy "nests_update_member"
  on public.nests for update using (public.is_nest_member(id));

drop policy if exists "workspace_members_select" on public.nest_members;
drop policy if exists "workspace_members_select_own" on public.nest_members;
drop policy if exists "workspace_members_insert_self" on public.nest_members;
create policy "nest_members_select"
  on public.nest_members for select using (public.is_nest_member(nest_id));
create policy "nest_members_select_own"
  on public.nest_members for select using (auth.uid() = user_id);
create policy "nest_members_insert_self"
  on public.nest_members for insert with check (auth.uid() = user_id);

-- 7) Bootstrap RPC
drop function if exists public.create_household_workspace(text);

create or replace function public.create_household_nest(p_invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nest uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.nests (name, invite_token_hash)
  values ('Nest', p_invite_token_hash)
  returning id into nest;

  insert into public.nest_members (nest_id, user_id, role)
  values (nest, uid, 'owner');

  -- No default Locale here: user must create Locale with real center (Fail Fast).
  return nest;
end;
$$;

grant execute on function public.create_household_nest(text) to authenticated;
```

- [ ] **Step 2: Apply migration** in the project’s Supabase project (SQL editor or CLI). Confirm `nests`, `nest_members`, `locales` exist; `listings.locale_id` not null; no `listings.workspace_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260822150000_nest_locale_foundation.sql
git commit -m "feat(db): nest rename and locale-scoped listings"
```

---

### Task 3: TypeScript types + nest helpers

**Files:**
- Modify: `src/lib/types/database.ts`
- Create: `src/lib/supabase/nest.ts`
- Delete: `src/lib/supabase/workspace.ts` (after call sites updated in Task 4–5; can replace in place by rewriting file then renaming)

**Interfaces:**
- Produces types: `Nest`, `NestMember`, `Locale`, updated `Listing` / `TourDay` with `locale_id`
- Produces:
  - `ensureNestForUser(supabase, userId): Promise<string>`
  - `getPrimaryNestId(supabase, userId): Promise<string | null>`
  - `listLocalesForNest(supabase, nestId): Promise<Locale[]>`
  - `getLocaleForNestMember(supabase, localeId): Promise<Locale | null>` — null if not member / missing
  - `localeNeedsSetup(locale: Pick<Locale,'center_lat'|'center_lng'>): boolean` — true when both coords are `0`

- [ ] **Step 1: Update `database.ts`**

Replace Workspace types with:

```ts
export type NestRole = 'owner' | 'member';

export type Nest = {
  id: string;
  name: string;
  invite_token_hash: string;
  created_at: string;
};

export type NestMember = {
  nest_id: string;
  user_id: string;
  role: NestRole;
  created_at: string;
};

export type Locale = {
  id: string;
  nest_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  center_label: string | null;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  locale_id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  source_url: string | null;
  photo_path: string | null;
  photo_url: string | null;
  appointment_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TourDay = {
  id: string;
  locale_id: string;
  tour_date: string;
  label: string | null;
  encoded_polyline: string | null;
  start_address: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_address: string | null;
  end_lat: number | null;
  end_lng: number | null;
  created_at: string;
};
```

Update `Database.public.Tables` keys: `nests`, `nest_members`, `locales`, and listing/tour_day insert types to require `locale_id`. Add RPC typing if present:

```ts
Functions: {
  create_household_nest: {
    Args: { p_invite_token_hash: string };
    Returns: string;
  };
  nest_id_for_invite: {
    Args: { token_hash: string };
    Returns: string;
  };
};
```

(Match whatever shape this repo already uses for RPCs; if `Database` has no `Functions` key yet, add it under `public`.)

- [ ] **Step 2: Implement `nest.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteToken } from '../crypto/invite-token';
import type { Database, Locale } from '../types/database';

type Client = SupabaseClient<Database>;

export function localeNeedsSetup(
  locale: Pick<Locale, 'center_lat' | 'center_lng'>,
): boolean {
  return locale.center_lat === 0 && locale.center_lng === 0;
}

export async function ensureNestForUser(supabase: Client, userId: string) {
  const { data: existing, error: memberError } = await supabase
    .from('nest_members')
    .select('nest_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (existing?.nest_id) return existing.nest_id;

  const { hash } = generateInviteToken();
  const { data: nestId, error: rpcError } = await supabase.rpc(
    'create_household_nest',
    { p_invite_token_hash: hash },
  );

  if (rpcError) throw new Error(rpcError.message);
  if (!nestId) throw new Error('Nest bootstrap returned no id');
  return nestId as string;
}

export async function getPrimaryNestId(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('nest_members')
    .select('nest_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.nest_id ?? null;
}

export async function listLocalesForNest(supabase: Client, nestId: string) {
  const { data, error } = await supabase
    .from('locales')
    .select('*')
    .eq('nest_id', nestId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Locale[];
}

export async function getLocaleForNestMember(
  supabase: Client,
  localeId: string,
) {
  const { data, error } = await supabase
    .from('locales')
    .select('*')
    .eq('id', localeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Locale | null) ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/database.ts src/lib/supabase/nest.ts
git commit -m "feat: add Nest and Locale TypeScript types and helpers"
```

---

### Task 4: Create Locale API + Nest home + new Locale page

**Files:**
- Create: `src/pages/api/locales/create.ts`
- Modify: `src/pages/app/index.astro`
- Create: `src/pages/app/locales/new.astro`

**Interfaces:**
- Consumes: `ensureNestForUser`, `listLocalesForNest`, `localeNeedsSetup`, `DEFAULT_NEW_LOCALE_RADIUS_M`
- `POST /api/locales/create` body: `name`, `center_lat`, `center_lng`, `radius_m?`, `center_label?` → `{ id: string }` or error

- [ ] **Step 1: Implement create API**

```ts
import type { APIRoute } from 'astro';
import { DEFAULT_NEW_LOCALE_RADIUS_M } from '../../../lib/geo/locale-area';
import { ensureNestForUser, getPrimaryNestId } from '../../../lib/supabase/nest';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const supabase = locals.supabase;
  if (!user || !supabase) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json() as {
    name?: string;
    center_lat?: number;
    center_lng?: number;
    radius_m?: number;
    center_label?: string | null;
  };

  if (!body.name?.trim()) {
    return new Response(JSON.stringify({ error: 'Name required' }), { status: 400 });
  }
  if (
    typeof body.center_lat !== 'number' ||
    typeof body.center_lng !== 'number' ||
    Number.isNaN(body.center_lat) ||
    Number.isNaN(body.center_lng)
  ) {
    return new Response(JSON.stringify({ error: 'Center lat/lng required' }), {
      status: 400,
    });
  }

  let nestId = await getPrimaryNestId(supabase, user.id);
  if (!nestId) nestId = await ensureNestForUser(supabase, user.id);

  const radius_m =
    typeof body.radius_m === 'number' && body.radius_m > 0
      ? body.radius_m
      : DEFAULT_NEW_LOCALE_RADIUS_M;

  const { data, error } = await supabase
    .from('locales')
    .insert({
      nest_id: nestId,
      name: body.name.trim(),
      center_lat: body.center_lat,
      center_lng: body.center_lng,
      radius_m,
      center_label: body.center_label ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Nest home lists Locales** — rewrite `src/pages/app/index.astro` to load nest + locales; link each to `/app/locales/${id}`; show “Needs setup” when `localeNeedsSetup`; link “New Locale” → `/app/locales/new`. Title: `Wayhome — Nest`.

- [ ] **Step 3: `locales/new.astro`** — form: name, center_lat, center_lng, optional radius_m / center_label; POST via fetch to `/api/locales/create`; redirect to `/app/locales/${id}`.

- [ ] **Step 4: Manual smoke** — sign in → Nest home → create Locale with real coords → appears in list.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/locales/create.ts src/pages/app/index.astro src/pages/app/locales/new.astro
git commit -m "feat: Nest home and Locale create flow"
```

---

### Task 5: Locale hub + move listings/tours/unscheduled under Locale

**Files:**
- Create: `src/pages/app/locales/[localeId]/index.astro`
- Move/adapt: listings, unscheduled, tours pages under `src/pages/app/locales/[localeId]/`
- Add thin redirects from old `/app/listings` etc. → Nest home or 410 — **prefer redirect to `/app`** with message (Fail Fast: no silent dual UI)
- Update all API routes that insert/query by `workspace_id` to use `locale_id`
- Update: `signup.astro`, `invite/[token].astro`, `settings.astro` for nest naming + `nest_id_for_invite` / `nest_members`

**Interfaces:**
- Every Locale-scoped page: load `locale` via `getLocaleForNestMember`; if null → 404; if `localeNeedsSetup` → banner + link to edit (edit can be same as create fields via update API minimal PATCH in this task or inline update form)
- Listing create body includes `locale_id` from the page

- [ ] **Step 1: Locale hub page** with nav: Listings, Unscheduled, Tours, Compare (Compare link can 404 stub until proximity UI plan — **omit Compare link in this plan**), Back to Nest.

- [ ] **Step 2: Relocate pages** under `[localeId]/` and filter queries with `.eq('locale_id', localeId)`.

- [ ] **Step 3: Update APIs** (`listings/create`, `listings/update`, `tours/*`, `promote-scratch`, etc.) to read `locale_id` and stop using `workspace_id`.

- [ ] **Step 4: Update invite flow** to `nest_id_for_invite` + `nest_members`.

- [ ] **Step 5: Delete `workspace.ts`; fix all imports to `nest.ts`.

- [ ] **Step 6: Run** `npm test` and `npm run build` — fix type errors.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages src/lib/supabase
git commit -m "feat: scope listings and tours to Locale routes"
```

---

### Task 6: Auto-expand Locale radius on geocode / listing save

**Files:**
- Modify: `src/pages/api/listings/geocode.ts` and/or `listings/update.ts` / `create.ts`
- Test: extend `tests/locale-area.test.ts` if new pure wrapper added

**Interfaces:**
- After a listing gains lat/lng: load Locale; `expandRadiusToInclude`; if radius grew, `update locales set radius_m = …` (POI refresh is proximity-engine plan — only expand here)

- [ ] **Step 1: Add helper** `async function ensureLocaleCoversPoint(supabase, localeId, point)` in `nest.ts` or `locale-area` caller module `src/lib/geo/ensure-locale-covers.ts`.

- [ ] **Step 2: Call it** from geocode success path and from create/update when coords present.

- [ ] **Step 3: Commit**

```bash
git add src/lib/geo/ensure-locale-covers.ts src/pages/api/listings
git commit -m "feat: auto-expand Locale radius when listing falls outside"
```

---

### Task 7: Product copy pass (Wayhome / Nest / Locale)

**Files:**
- Modify page `<title>` and visible headings in touched app pages; login/signup marketing strings that say “Workspace” / “Real Estate Mapper” → Wayhome / Nest where user-facing.

- [ ] **Step 1: Grep** for `Workspace`, `workspace`, `Real Estate Mapper` in `src/pages` and update user-visible copy only (keep internal code identifiers already renamed).

- [ ] **Step 2: Commit**

```bash
git add src/pages
git commit -m "docs(ui): Wayhome Nest and Locale product copy"
```

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Nest = shared household / rename workspace | 2, 3, 5 |
| Locale center + radius; listings/tours scoped | 2, 5 |
| Nest home list Locales; create Locale | 4 |
| Auto-expand radius | 1, 6 |
| Fail Fast no invented center | 2 (0,0 needs setup), 4 create requires coords |
| No proximity POI/Compare | deferred to follow-on plans |
| Migration backfill | 2 |

**Out of scope here:** proximity_criteria, locale_pois, proximity_results, Compare UI, Places/Matrix APIs.
