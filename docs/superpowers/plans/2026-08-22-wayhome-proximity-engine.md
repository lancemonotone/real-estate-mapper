# Wayhome Proximity Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Locale-scoped proximity criteria, POI cache, and lazy travel-time compute (nearest curated type + fixed pin) with persisted results — no Compare UI yet.

**Architecture:** Server modules call Places API (New) `searchNearby` / `searchText` to fill `locale_pois`, shortlist by haversine, then Routes `computeRouteMatrix` to pick min duration. API routes mutate criteria and compute/upsert `proximity_results`. Pure functions own shortlist + winner selection (Vitest).

**Tech Stack:** Existing Astro API routes, `GOOGLE_MAPS_API_KEY`, Places API (New), Routes API matrix, Vitest.

**Depends on:** `docs/superpowers/plans/2026-08-22-wayhome-nest-locale-foundation.md`  
**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-nest-locale-proximity-design.md`  
**Follow-on:** `2026-08-22-wayhome-proximity-ui.md`

## Global Constraints

- Shown distance/time is travel via Routes; haversine only for candidate shortlist.
- Travel mode is per criterion (`DRIVE` | `WALK` | `BICYCLE` | `TRANSIT`).
- Never invent results: use statuses `needs_geocode` | `no_place` | `error` | `ok`.
- Cap shortlist `N = 5`; no eager Nest-wide recompute on login.
- Persist `proximity_results` only for saved criteria (no orphan one-off rows).
- Branch from `staging` after foundation merges; feature branch `feature/plan-proximity-engine`.

---

## File structure

```
supabase/migrations/
  20260822160000_proximity_tables.sql
src/lib/
  proximity/
    place-types.ts          # curated catalog → Google strategy
    shortlist.ts            # haversine top N
    pick-winner.ts          # min duration among matrix rows
    maps-url.ts             # Google Maps link for place/pin
  google/
    places-nearby.ts        # searchNearby
    places-text.ts          # searchText (beach)
    route-matrix.ts         # computeRouteMatrix
src/pages/api/proximity/
  criteria.ts               # POST create / DELETE
  refresh-pois.ts           # fill locale_pois for types in use
  compute.ts                # lazy compute one listing×criterion or batch stale
tests/
  proximity-shortlist.test.ts
  proximity-pick-winner.test.ts
  place-types.test.ts
```

---

### Task 1: Curated place types + shortlist + winner (TDD)

**Files:**
- Create: `src/lib/proximity/place-types.ts`, `shortlist.ts`, `pick-winner.ts`, `maps-url.ts`
- Test: `tests/place-types.test.ts`, `tests/proximity-shortlist.test.ts`, `tests/proximity-pick-winner.test.ts`

**Interfaces:**
```ts
export type PlaceTypeKey =
  | 'beach'
  | 'park'
  | 'grocery'
  | 'school'
  | 'gym'
  | 'transit';

export type PlaceTypeStrategy =
  | { kind: 'nearby'; includedTypes: string[] }
  | { kind: 'text'; textQuery: string };

export const PLACE_TYPE_CATALOG: Record<
  PlaceTypeKey,
  { label: string; strategy: PlaceTypeStrategy }
> = {
  beach: { label: 'Beach', strategy: { kind: 'text', textQuery: 'beach' } },
  park: { label: 'Park', strategy: { kind: 'nearby', includedTypes: ['park'] } },
  grocery: {
    label: 'Grocery',
    strategy: { kind: 'nearby', includedTypes: ['grocery_store'] },
  },
  school: {
    label: 'School',
    strategy: { kind: 'nearby', includedTypes: ['school'] },
  },
  gym: { label: 'Gym', strategy: { kind: 'nearby', includedTypes: ['gym'] } },
  transit: {
    label: 'Transit station',
    strategy: { kind: 'nearby', includedTypes: ['transit_station'] },
  },
};

export const PROXIMITY_SHORTLIST_N = 5;

export type PoiCandidate = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};

export function shortlistPois(
  origin: { lat: number; lng: number },
  pois: PoiCandidate[],
  n: number,
): PoiCandidate[];

export type MatrixLeg = {
  destinationIndex: number;
  durationSec: number;
  distanceM: number;
  ok: boolean;
};

export function pickWinnerByDuration(
  candidates: PoiCandidate[],
  legs: MatrixLeg[],
): { poi: PoiCandidate; durationSec: number; distanceM: number } | null;

export function googleMapsPlaceUrl(placeId: string): string;
export function googleMapsCoordUrl(lat: number, lng: number): string;
```

- [ ] **Step 1: Failing tests**

```ts
// tests/proximity-shortlist.test.ts
import { describe, expect, it } from 'vitest';
import { shortlistPois } from '../src/lib/proximity/shortlist';

describe('shortlistPois', () => {
  it('returns nearest n by haversine', () => {
    const origin = { lat: 0, lng: 0 };
    const pois = [
      { placeId: 'far', name: 'Far', lat: 1, lng: 1 },
      { placeId: 'near', name: 'Near', lat: 0.01, lng: 0 },
      { placeId: 'mid', name: 'Mid', lat: 0.1, lng: 0 },
    ];
    const top = shortlistPois(origin, pois, 2);
    expect(top.map((p) => p.placeId)).toEqual(['near', 'mid']);
  });

  it('returns empty when no pois', () => {
    expect(shortlistPois({ lat: 0, lng: 0 }, [], 5)).toEqual([]);
  });
});
```

```ts
// tests/proximity-pick-winner.test.ts
import { describe, expect, it } from 'vitest';
import { pickWinnerByDuration } from '../src/lib/proximity/pick-winner';

describe('pickWinnerByDuration', () => {
  const candidates = [
    { placeId: 'a', name: 'A', lat: 1, lng: 1 },
    { placeId: 'b', name: 'B', lat: 2, lng: 2 },
  ];

  it('picks minimum duration among ok legs', () => {
    const winner = pickWinnerByDuration(candidates, [
      { destinationIndex: 0, durationSec: 600, distanceM: 1000, ok: true },
      { destinationIndex: 1, durationSec: 300, distanceM: 800, ok: true },
    ]);
    expect(winner?.poi.placeId).toBe('b');
    expect(winner?.durationSec).toBe(300);
  });

  it('returns null when no ok legs', () => {
    expect(
      pickWinnerByDuration(candidates, [
        { destinationIndex: 0, durationSec: 0, distanceM: 0, ok: false },
      ]),
    ).toBeNull();
  });
});
```

```ts
// tests/place-types.test.ts
import { describe, expect, it } from 'vitest';
import { PLACE_TYPE_CATALOG } from '../src/lib/proximity/place-types';

describe('PLACE_TYPE_CATALOG', () => {
  it('maps beach to text strategy', () => {
    expect(PLACE_TYPE_CATALOG.beach.strategy.kind).toBe('text');
  });
  it('maps park to nearby park type', () => {
    expect(PLACE_TYPE_CATALOG.park.strategy).toEqual({
      kind: 'nearby',
      includedTypes: ['park'],
    });
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/proximity-shortlist.test.ts tests/proximity-pick-winner.test.ts tests/place-types.test.ts` — expect FAIL

- [ ] **Step 3: Implement** modules to match interfaces (use `haversineMeters` in shortlist; Maps URLs `https://www.google.com/maps/search/?api=1&query_place_id=` and `https://www.google.com/maps/search/?api=1&query=lat,lng`)

- [ ] **Step 4: Run tests — PASS; commit**

```bash
git add src/lib/proximity tests/proximity-shortlist.test.ts tests/proximity-pick-winner.test.ts tests/place-types.test.ts
git commit -m "feat: proximity shortlist, winner pick, and place type catalog"
```

---

### Task 2: Proximity tables migration

**Files:**
- Create: `supabase/migrations/20260822160000_proximity_tables.sql`

```sql
create table public.proximity_criteria (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.locales (id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('place_type', 'fixed_pin')),
  place_type_key text,
  pin_lat double precision,
  pin_lng double precision,
  pin_place_id text,
  pin_name text,
  travel_mode text not null check (travel_mode in ('DRIVE', 'WALK', 'BICYCLE', 'TRANSIT')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint proximity_criteria_type_fields check (
    (kind = 'place_type' and place_type_key is not null)
    or
    (kind = 'fixed_pin' and pin_lat is not null and pin_lng is not null)
  )
);

create index proximity_criteria_locale_id_idx on public.proximity_criteria (locale_id);

alter table public.proximity_criteria enable row level security;

create policy "proximity_criteria_all_member"
  on public.proximity_criteria for all
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

create table public.locale_pois (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.locales (id) on delete cascade,
  place_type_key text not null,
  place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  fetched_at timestamptz not null default now(),
  unique (locale_id, place_type_key, place_id)
);

create index locale_pois_locale_type_idx
  on public.locale_pois (locale_id, place_type_key);

alter table public.locale_pois enable row level security;

create policy "locale_pois_all_member"
  on public.locale_pois for all
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

create table public.proximity_results (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  criterion_id uuid not null references public.proximity_criteria (id) on delete cascade,
  status text not null check (status in ('ok', 'needs_geocode', 'no_place', 'error')),
  place_id text,
  place_name text,
  place_lat double precision,
  place_lng double precision,
  duration_sec integer,
  distance_m integer,
  maps_url text,
  error_message text,
  computed_at timestamptz not null default now(),
  unique (listing_id, criterion_id)
);

create index proximity_results_criterion_id_idx on public.proximity_results (criterion_id);

alter table public.proximity_results enable row level security;

create policy "proximity_results_all_member"
  on public.proximity_results for all
  using (
    exists (
      select 1
      from public.listings li
      join public.locales loc on loc.id = li.locale_id
      where li.id = listing_id and public.is_nest_member(loc.nest_id)
    )
  )
  with check (
    exists (
      select 1
      from public.listings li
      join public.locales loc on loc.id = li.locale_id
      where li.id = listing_id and public.is_nest_member(loc.nest_id)
    )
  );
```

- [ ] **Step 1: Add migration; apply; update `database.ts` types for the three tables**

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260822160000_proximity_tables.sql src/lib/types/database.ts
git commit -m "feat(db): proximity criteria, POI cache, and results tables"
```

---

### Task 3: Google Places + Route Matrix clients

**Files:**
- Create: `src/lib/google/places-nearby.ts`, `places-text.ts`, `route-matrix.ts`
- Test: `tests/route-matrix-parse.test.ts` (parse helper with fixture JSON; no live HTTP)

**Verified endpoints:**
- Places Nearby: `POST https://places.googleapis.com/v1/places:searchNearby` with `includedTypes`, `locationRestriction.circle`, `maxResultCount`, header `X-Goog-FieldMask: places.id,places.displayName,places.location`
- Places Text: `POST https://places.googleapis.com/v1/places:searchText` with `textQuery`, `locationBias.circle` (same field mask)
- Route Matrix: `POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix` with `origins`, `destinations`, `travelMode`, field mask `originIndex,destinationIndex,duration,distanceMeters,status,condition`

**Interfaces:**
```ts
export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';

export async function searchNearbyPlaces(input: {
  lat: number;
  lng: number;
  radiusM: number;
  includedTypes: string[];
  maxResultCount?: number;
}): Promise<PoiCandidate[]>;

export async function searchTextPlaces(input: {
  lat: number;
  lng: number;
  radiusM: number;
  textQuery: string;
  maxResultCount?: number;
}): Promise<PoiCandidate[]>;

export async function computeRouteMatrix(input: {
  origin: { lat: number; lng: number };
  destinations: Array<{ lat: number; lng: number }>;
  travelMode: TravelMode;
}): Promise<MatrixLeg[]>;
```

Circle radius for Places: use `Math.min(locale.radius_m, 50000)` (Places Nearby max circle radius is 50km per Google docs). If Locale radius > 50km, tile with multiple circle searches covering the Locale (grid of centers) and dedupe by `place_id` — implement tiling in `src/lib/proximity/fill-pois.ts`.

- [ ] **Step 1: Implement clients using `requireEnv('GOOGLE_MAPS_API_KEY')`; throw on non-OK HTTP with body text**

- [ ] **Step 2: Unit-test duration parse / matrix row mapping with fixture**

- [ ] **Step 3: Commit**

```bash
git add src/lib/google/places-nearby.ts src/lib/google/places-text.ts src/lib/google/route-matrix.ts tests/route-matrix-parse.test.ts
git commit -m "feat: Places Nearby/Text and Routes matrix clients"
```

---

### Task 4: Fill POIs + compute result service

**Files:**
- Create: `src/lib/proximity/fill-pois.ts`, `compute-result.ts`
- Create: `src/pages/api/proximity/refresh-pois.ts`, `compute.ts`, `criteria.ts`

**Interfaces:**
```ts
export async function fillLocalePoisForType(
  supabase: Client,
  locale: Locale,
  placeTypeKey: PlaceTypeKey,
): Promise<number>; // upsert count

export async function computeProximityResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
): Promise<ProximityResultRow>;
```

**computeProximityResult algorithm:**
1. Load listing + criterion; verify same locale via joins.
2. If listing missing lat/lng → upsert status `needs_geocode`, return.
3. If `kind === 'fixed_pin'`: matrix/single route origin=listing dest=pin; on success `ok` else `error`.
4. If `kind === 'place_type'`: load `locale_pois` for type; if empty try `fillLocalePoisForType` once; if still empty → `no_place`.
5. `shortlistPois` → `computeRouteMatrix` → `pickWinnerByDuration`; null → `error` or `no_place`.
6. Upsert `proximity_results` with maps URL from `googleMapsPlaceUrl` / coord URL.

**criteria API:**
- `POST` JSON `{ locale_id, label, kind, place_type_key?, pin_*, travel_mode, sort_order? }`
- `DELETE` `?id=`
- On create `place_type`, call `fillLocalePoisForType` (await; surface error if Places fails)

**compute API:**
- `POST` `{ listing_id, criterion_id }` or `{ locale_id, refresh_stale: true }` for all missing/stale pairs in locale (stale = no row OR listing `updated_at` > `computed_at`)

**refresh-pois API:**
- `POST` `{ locale_id }` → for each distinct `place_type_key` on criteria, fill

- [ ] **Step 1: Implement services + APIs**

- [ ] **Step 2: Manual smoke with mocked or live key in local only** — create criterion, compute one listing, inspect row status

- [ ] **Step 3: Commit**

```bash
git add src/lib/proximity src/pages/api/proximity
git commit -m "feat: proximity POI fill, criteria API, and lazy compute"
```

---

### Task 5: Invalidate results on expand / listing coord change

**Files:**
- Modify: `src/lib/geo/ensure-locale-covers.ts` (from foundation) and listing geocode/update paths
- After Locale radius expand: delete `locale_pois` for that locale (force refresh) and delete `proximity_results` for criteria in that locale (or mark stale by deleting)
- After listing lat/lng change: delete that listing’s `proximity_results`

- [ ] **Step 1: Implement delete helpers; wire call sites**

- [ ] **Step 2: Commit**

```bash
git add src/lib src/pages/api
git commit -m "feat: invalidate proximity cache on locale expand or coord change"
```

---

## Plan self-review

| Spec item | Task |
|-----------|------|
| Curated types | 1 |
| POI cache + Places | 3, 4 |
| Shortlist + matrix winner | 1, 3, 4 |
| Fixed pin mode | 4 |
| Lazy compute + statuses | 4 |
| Mode per criterion | 2, 4 |
| Invalidate on expand | 5 |
| No Compare UI | deferred |
