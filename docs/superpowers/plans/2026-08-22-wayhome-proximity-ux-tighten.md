# Wayhome Proximity UX Tighten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist listing-private places and Compare-cell locks; replace lat/lng pin entry with Google place search; rename UX from “criterion / one-off” to Compare columns vs Saved for this listing.

**Architecture:** Keep `proximity_criteria` / `proximity_results` as Locale Compare columns and cells. Add `listing_places` for private saves and `proximity_results.locked` for per-listing Nearest overrides. Server Places Autocomplete + Place Details resolve pins; compute refreshes locked cells by re-routing to the locked place only. Listing and Compare UIs get a copy + flow pass.

**Tech Stack:** Astro SSR, Supabase, Places API (New) Autocomplete + Details, existing Routes matrix / proximity engine, vanilla JS panels.

**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-proximity-ux-tighten-design.md`

## Global Constraints

- UI copy: Compare column, Nearest, Shared place, Saved for this listing, Lock — never “criterion / one-off / Save as criterion / fixed pin / lat/lng” in user-facing strings.
- Listing-private places never appear on Compare.
- Locks stick until unlock; locked recompute must not swap `place_id`.
- Fail Fast: no invented coords, places, or zero travel times on error.
- No soft “nearer available” hints; no attribute compare / calendar work.
- Work on `staging` (no git worktrees). Apply migrations with `npm run db:push`.

---

## File structure

```
supabase/migrations/
  20260822190000_listing_places_and_locks.sql
src/lib/google/
  places-autocomplete.ts      # NEW — places:autocomplete
  places-details.ts           # NEW — GET places/{id}
src/lib/proximity/
  compute-core.ts             # lock-aware evaluate + route-to-place helper
  compute-result.ts           # preserve locked on upsert; refreshLockedRoute
  listing-places.ts           # NEW — CRUD helpers (optional thin)
src/lib/types/database.ts     # ListingPlace, locked on ProximityResult
src/pages/api/places/
  autocomplete.ts             # NEW
  details.ts                  # NEW
src/pages/api/proximity/
  criteria.ts                 # Shared place via place_id; find-or-create
  listing-places.ts           # NEW — POST/DELETE listing_places
  lock.ts                     # NEW — POST lock / unlock cell
  compute.ts                  # respect locks (via compute-result)
public/scripts/
  place-search.js             # NEW — shared typeahead widget
  listing-proximity.js        # rewire explore + save actions
  proximity-compare.js        # copy + Shared place search + lock badge
src/pages/app/locales/[localeId]/
  compare.astro
  listings/[id].astro
```

---

### Task 1: Schema — `listing_places` + `proximity_results.locked`

**Files:**
- Create: `supabase/migrations/20260822190000_listing_places_and_locks.sql`
- Modify: `src/lib/types/database.ts`
- Test: typecheck / manual `npm run db:push`

**Interfaces:**
- `ProximityResult.locked: boolean` (default false)
- `ListingPlace` row type matching table below

- [ ] **Step 1: Write migration**

```sql
alter table public.proximity_results
  add column locked boolean not null default false;

create table public.listing_places (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  travel_mode text not null check (travel_mode in ('DRIVE', 'WALK', 'BICYCLE', 'TRANSIT')),
  label text,
  duration_sec integer,
  distance_m integer,
  maps_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, place_id, travel_mode)
);

create index listing_places_listing_id_idx on public.listing_places (listing_id);

alter table public.listing_places enable row level security;

create policy "listing_places_all_member"
  on public.listing_places for all
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

- [ ] **Step 2: Apply** — `npm run db:push` (expect success)

- [ ] **Step 3: Update `database.ts`** — add `locked` to `ProximityResult`; add `ListingPlace` type and `listing_places` table entry in `Database`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260822190000_listing_places_and_locks.sql src/lib/types/database.ts
git commit -m "feat: listing_places table and proximity_results.locked"
```

---

### Task 2: Lock-aware compute

**Files:**
- Modify: `src/lib/proximity/compute-core.ts`
- Modify: `src/lib/proximity/compute-result.ts`
- Create: `tests/proximity-lock.test.ts`

**Interfaces:**
```ts
// compute-result.ts
export async function computeProximityResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
): Promise<ProximityResultRow & { candidates?: ProximityOutcome['candidates'] }>;
// When existing row.locked === true and status ok with place coords:
//   re-route listing → locked place; upsert duration/distance/maps_url/computed_at;
//   keep place_* and locked=true. Do not call evaluatePlaceType winner path.

export async function setProximityResultLock(
  supabase: Client,
  listingId: string,
  criterionId: string,
  locked: boolean,
): Promise<ProximityResultRow>;
// unlock: set locked=false only (do not delete row; next compute may auto-pick)

export async function upsertLockedProximityResult(
  supabase: Client,
  listingId: string,
  criterionId: string,
  place: {
    place_id: string;
    place_name: string;
    place_lat: number;
    place_lng: number;
    duration_sec: number;
    distance_m: number;
    maps_url: string;
  },
): Promise<ProximityResultRow>;
// status ok, locked true
```

- [ ] **Step 1: Failing test** — pure helper for “shouldRefreshLockedOnly”

```ts
// tests/proximity-lock.test.ts
import { describe, expect, it } from 'vitest';
import { shouldRefreshLockedRoute } from '../src/lib/proximity/compute-result';

describe('shouldRefreshLockedRoute', () => {
  it('true when locked ok with coords', () => {
    expect(
      shouldRefreshLockedRoute({
        locked: true,
        status: 'ok',
        place_lat: 1,
        place_lng: 2,
        place_id: 'x',
        place_name: 'X',
      }),
    ).toBe(true);
  });
  it('false when unlocked', () => {
    expect(
      shouldRefreshLockedRoute({
        locked: false,
        status: 'ok',
        place_lat: 1,
        place_lng: 2,
        place_id: 'x',
        place_name: 'X',
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `shouldRefreshLockedRoute` + locked branch in `computeProximityResult`**

Before `evaluateCriterionProximity`, load existing result for `(listingId, criterionId)`. If `shouldRefreshLockedRoute(existing)`:

1. Load listing origin (reuse needs_geocode path).
2. Load criterion for `travel_mode`.
3. Call `computeRouteMatrix` with single destination = locked lat/lng.
4. Upsert outcome keeping place_* from existing, new duration/distance/maps_url, `locked: true`.
5. Return row **without** candidates (or empty).

Otherwise evaluate + upsert with `locked: existing?.locked ?? false` (never clear lock on auto upsert unless unlocking API).

**Critical:** `upsertResult` must include `locked` in payload and must not set `locked: false` accidentally on normal compute. Default: preserve existing lock flag when upserting auto outcomes (`locked: existing?.locked ?? false`). Auto winner path for locked rows is skipped entirely by the early return above.

- [ ] **Step 3: Run** `npx vitest run tests/proximity-lock.test.ts` — expect PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/proximity/compute-result.ts src/lib/proximity/compute-core.ts tests/proximity-lock.test.ts
git commit -m "feat: lock-aware proximity recompute"
```

---

### Task 3: Places autocomplete + details (server)

**Files:**
- Create: `src/lib/google/places-autocomplete.ts`
- Create: `src/lib/google/places-details.ts`
- Create: `src/pages/api/places/autocomplete.ts`
- Create: `src/pages/api/places/details.ts`

**Interfaces:**
```ts
// places-autocomplete.ts
export type PlaceSuggestion = {
  placeId: string; // resource name without places/ prefix preferred, or full — be consistent
  primaryText: string;
  secondaryText: string;
};

export async function autocompletePlaces(input: {
  text: string;
  lat: number;
  lng: number;
  radiusM: number;
  sessionToken: string;
}): Promise<PlaceSuggestion[]>;
// POST https://places.googleapis.com/v1/places:autocomplete
// body: { input, sessionToken, locationBias: { circle: { center, radius } } }
// Fail Fast on !res.ok via formatGoogleApiError

// places-details.ts
export type PlaceDetails = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};

export async function fetchPlaceDetails(input: {
  placeId: string;
  sessionToken?: string;
}): Promise<PlaceDetails>;
// GET https://places.googleapis.com/v1/places/{placeId}
// FieldMask: id,displayName,location
// Throw if missing coords or name
```

- [ ] **Step 1: Implement google helpers** (mirror `places-nearby.ts` auth headers / error formatting)

- [ ] **Step 2: API routes** — auth required; autocomplete body `{ input, locale_id, session_token }`; load locale center/radius for bias; details body `{ place_id, session_token? }`; return JSON; 400 on empty input / missing place_id

- [ ] **Step 3: Manual smoke** — curl or browser against autocomplete with a known locale (optional while implementing)

- [ ] **Step 4: Commit**

```bash
git add src/lib/google/places-autocomplete.ts src/lib/google/places-details.ts src/pages/api/places
git commit -m "feat: Places autocomplete and details API"
```

---

### Task 4: Listing places + lock/unlock + find-or-create column APIs

**Files:**
- Create: `src/pages/api/proximity/listing-places.ts`
- Create: `src/pages/api/proximity/lock.ts`
- Modify: `src/pages/api/proximity/criteria.ts` (accept `pin_place_id` resolve path; optional find-or-create query)

**Interfaces:**
```ts
// POST /api/proximity/listing-places
// { listing_id, place_id, name, lat, lng, travel_mode, label?, duration_sec?, distance_m?, maps_url? }
// upsert on (listing_id, place_id, travel_mode)

// DELETE /api/proximity/listing-places?id=

// POST /api/proximity/lock
// { listing_id, criterion_id, locked: boolean }
// if locked true: body must include place fields OR existing ok result; set locked + place via upsertLockedProximityResult
// if locked false: setProximityResultLock(..., false)

// POST /api/proximity/criteria — when kind fixed_pin:
// prefer { pin_place_id, pin_name, pin_lat, pin_lng } from client after details resolve
// Optional: GET or POST find — if body.find_or_create === true, select existing where
//   locale_id + kind place_type + place_type_key + travel_mode
//   OR locale_id + kind fixed_pin + pin_place_id + travel_mode
// before insert; return existing silently
```

- [ ] **Step 1: Implement listing-places POST/DELETE**

- [ ] **Step 2: Implement lock POST**

- [ ] **Step 3: Extend criteria create with find_or_create**

```ts
// Pseudocode inside POST after validation:
if (body.find_or_create === true) {
  let q = supabase.from('proximity_criteria').select('*').eq('locale_id', localeId).eq('travel_mode', travelMode);
  if (kind === 'place_type') {
    q = q.eq('kind', 'place_type').eq('place_type_key', place_type_key);
  } else {
    q = q.eq('kind', 'fixed_pin').eq('pin_place_id', pin_place_id);
  }
  const { data: existing } = await q.maybeSingle();
  if (existing) return JSON { criterion: existing, reused: true };
}
// else insert as today
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/proximity
git commit -m "feat: listing places, lock, and find-or-create columns APIs"
```

---

### Task 5: Shared place-search JS widget

**Files:**
- Create: `public/scripts/place-search.js`

**Interfaces:**
```js
/**
 * mountPlaceSearch(rootEl, { localeId, onResolved })
 * rootEl contains: input[data-place-search-input], ul[data-place-search-results]
 * onResolved({ placeId, name, lat, lng })
 * Creates sessionToken (crypto.randomUUID) per focus session.
 * Debounce 250ms → POST /api/places/autocomplete
 * Click suggestion → POST /api/places/details → onResolved
 * Fail Fast: show error text in [data-place-search-error]; never invent lat/lng
 */
export function mountPlaceSearch(rootEl, options) { ... }
```

- [ ] **Step 1: Implement widget** (vanilla DOM; no jQuery)

- [ ] **Step 2: Commit**

```bash
git add public/scripts/place-search.js
git commit -m "feat: shared place search typeahead widget"
```

---

### Task 6: Listing proximity UI rewire

**Files:**
- Modify: `src/pages/app/locales/[localeId]/listings/[id].astro`
- Modify: `public/scripts/listing-proximity.js`
- Load: `place-search.js` as module

**UI structure (replace current one-off/criterion language):**
- Mode select: `Nearest type` | `Search place`
- Nearest: place type + travel mode + Find route
- Search: place-search mount + travel mode + Find route (route to resolved place via one-off fixed_pin compute or local routes)
- After successful find: buttons **Use for this listing** | **Add to Compare** (not Save as criterion)
- Section `#listing-places` rendered from server SSR query of `listing_places` + client refresh after save
- Section locked Compare bindings: SSR `proximity_results` where listing_id and locked, join criterion label; Unlock buttons → `/api/proximity/lock` `{ locked: false }`
- Remove lat/lng pin fields; remove sessionStorage as persistence (optional: drop session cache entirely)

**Add to Compare behavior:**
1. If mode was Nearest: `find_or_create` criteria `{ kind: place_type, place_type_key, travel_mode, label: catalog label, find_or_create: true }`
2. Then `POST /api/proximity/lock` with `{ locked: true, ...chosen place + duration }` OR upsertLocked via lock API
3. If mode was Search: find_or_create Shared place column with pin_* from resolved place; write result locked=false (shared destination) — for Shared place, lock flag unused; still write this listing’s result cell via compute or direct upsert

- [ ] **Step 1: Update Astro markup + SSR load listing_places + locked results**

- [ ] **Step 2: Rewire listing-proximity.js actions**

- [ ] **Step 3: Manual smoke** — save listing place, reload; Add to Compare Nearest with lock; unlock

- [ ] **Step 4: Commit**

```bash
git add src/pages/app/locales/[localeId]/listings/[id].astro public/scripts/listing-proximity.js
git commit -m "feat: listing proximity save actions and private places UI"
```

---

### Task 7: Compare page copy + Shared place search + lock badge

**Files:**
- Modify: `src/pages/app/locales/[localeId]/compare.astro`
- Modify: `public/scripts/proximity-compare.js`

- [ ] **Step 1: Copy** — “Add Compare column”; kind options “Nearest place type” / “Shared place”; remove pin lat/lng; mount place-search for Shared place; on submit resolve place then POST criteria with pin_* 

- [ ] **Step 2: Cells** — if `result.locked`, show lock badge (e.g. `🔒` text “Locked”) + Unlock control calling `/api/proximity/lock`

- [ ] **Step 3: Lazy compute** — unchanged endpoint; locked cells refresh time only (server Task 2)

- [ ] **Step 4: Commit**

```bash
git add src/pages/app/locales/[localeId]/compare.astro public/scripts/proximity-compare.js
git commit -m "feat: Compare columns UX with place search and locks"
```

---

### Task 8: Spec status + smoke checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-22-wayhome-proximity-ux-tighten-design.md` — Status: Approved

- [ ] **Step 1: Mark spec Approved**

- [ ] **Step 2: Manual checklist**
  - [ ] Search place → Use for this listing → reload shows Saved
  - [ ] Nearest beach → pick → Add to Compare → Compare shows locked cell
  - [ ] Unlock → Refresh → may change place
  - [ ] Compare add Shared place via search (no lat/lng fields)
  - [ ] No “criterion / one-off / Save as criterion” strings in listing/compare UI

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-22-wayhome-proximity-ux-tighten-design.md
git commit -m "docs: approve proximity UX tighten spec"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Compare columns vs listing places naming | 6, 7 |
| `listing_places` | 1, 4, 6 |
| `locked` + refresh route only | 1, 2, 4, 6, 7 |
| Place search (no lat/lng) | 3, 5, 6, 7 |
| Use for this listing / Add to Compare | 6 |
| find_or_create column reuse | 4, 6 |
| Listing-only not on Compare | 6, 7 |
| Fail Fast | 3, 5, global |
| Drop session as source of truth | 6 |

**Placeholder scan:** none intentional.  
**Type consistency:** `ListingPlace`, `locked`, `PlaceSuggestion`, `PlaceDetails`, `shouldRefreshLockedRoute`, `upsertLockedProximityResult`, `setProximityResultLock`, `mountPlaceSearch`, `find_or_create` — used consistently across tasks.
