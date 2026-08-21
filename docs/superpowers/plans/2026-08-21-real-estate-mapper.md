# Real Estate Mapper v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Astro + Supabase + Google Maps app where households collect property listings (manual + URL import), map them with photos, and optimize driving routes by day (plus scratch optimize for the unscheduled pool).

**Architecture:** Astro SSR owns auth-gated pages and server actions. Supabase provides Auth, Postgres (RLS), and Storage. Server calls Google Geocoding + Routes APIs; the browser loads Maps JavaScript API for markers and route display. Domain logic (URL extract, day grouping, destination pick, optimize request shaping) lives in pure TypeScript modules with Vitest.

**Tech Stack:** Astro (SSR, `@astrojs/node`), TypeScript, Vitest, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Google Maps Platform (Maps JS, Geocoding, Routes API).

## Global Constraints

- No invented listing fields (name/address/photo/lat/lng); empty means empty.
- No stock placeholder images.
- Driving only; appointment times do not reorder stops.
- Different `tour_date` values never share one optimized route.
- Unscheduled listings support scratch optimize; persist only via “Save as tour for [date]”.
- Start = origin; destination = farthest other geocoded listing (geodesic; tie-break lowest listing id).
- Google server keys never ship to the browser; missing env fails the action that needs them.
- Fail visibly on geocode/optimize/invite errors.
- Do not commit secrets (`.env`).
- Branch from `staging` (create `staging` from `main` if missing); never implement on `main`.

---

## File structure

```
/
├── .env.example
├── astro.config.mjs
├── package.json
├── vitest.config.ts
├── supabase/
│   └── migrations/
│       └── 20260821000000_init.sql
├── src/
│   ├── env.d.ts
│   ├── middleware.ts
│   ├── lib/
│   │   ├── env.ts
│   │   ├── supabase/
│   │   │   ├── client.ts          # browser
│   │   │   ├── server.ts          # SSR cookie client
│   │   │   └── admin.ts           # service role (invite hash ops if needed)
│   │   ├── crypto/invite-token.ts
│   │   ├── listings/
│   │   │   ├── url-extract.ts
│   │   │   └── day-grouping.ts
│   │   ├── geo/
│   │   │   ├── haversine.ts
│   │   │   └── pick-destination.ts
│   │   ├── google/
│   │   │   ├── geocode.ts
│   │   │   ├── routes.ts
│   │   │   └── optimize-request.ts
│   │   └── types/database.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── login.astro
│   │   ├── signup.astro
│   │   ├── invite/[token].astro
│   │   ├── app/
│   │   │   ├── index.astro              # workspace home
│   │   │   ├── listings/
│   │   │   │   ├── index.astro
│   │   │   │   ├── new.astro
│   │   │   │   └── [id].astro
│   │   │   ├── unscheduled.astro
│   │   │   ├── tours/
│   │   │   │   ├── index.astro
│   │   │   │   └── [id].astro
│   │   │   └── settings.astro
│   │   └── api/
│   │       ├── listings/
│   │       │   ├── create.ts
│   │       │   ├── update.ts
│   │       │   ├── import-url.ts
│   │       │   └── geocode.ts
│   │       ├── tours/
│   │       │   ├── create.ts
│   │       │   ├── assign.ts
│   │       │   ├── set-start.ts
│   │       │   ├── optimize.ts
│   │       │   └── promote-scratch.ts
│   │       └── workspace/
│   │           └── invite-rotate.ts
│   ├── components/
│   │   ├── ListingForm.astro
│   │   ├── ListingBadges.astro
│   │   ├── TourStopList.astro
│   │   └── map/
│   │       └── TourMap.tsx            # client island
│   └── styles/
│       └── global.css
└── tests/
    ├── url-extract.test.ts
    ├── day-grouping.test.ts
    ├── pick-destination.test.ts
    └── optimize-request.test.ts
```

---

### Task 1: Branch + Astro scaffold + Vitest

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/pages/index.astro`, `src/env.d.ts`, `.env.example`
- Modify: `.gitignore` (ensure `.env`, `dist`, `node_modules`)

**Interfaces:**
- Produces: runnable `npm run dev`, `npm test`; `src/env.d.ts` ambient types for `ImportMetaEnv`

- [ ] **Step 1: Create integration branch and feature branch**

```bash
cd /c/htdocs/real-estate-mapper
git checkout main
git branch staging 2>/dev/null || true
git checkout staging
git merge main -m "sync staging with main" || true
git checkout -b feature/plan-01-real-estate-mapper
```

Expected: on `feature/plan-01-real-estate-mapper`.

- [ ] **Step 2: Scaffold Astro (TypeScript, minimal)**

```bash
npm create astro@latest . -- --template minimal --typescript strict --install --no-git --yes
npx astro add node --yes
npm install vitest @types/node --save-dev
npm install @supabase/supabase-js @supabase/ssr
```

If the create command refuses a non-empty directory, scaffold in a temp folder and move `src`, `public`, config files into the repo root without deleting `docs/` or `.cursor/`.

- [ ] **Step 3: Configure Astro SSR**

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
```

- [ ] **Step 4: Add Vitest config and npm scripts**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

In `package.json` scripts add: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Write `.env.example`**

```bash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
GOOGLE_MAPS_API_KEY=
PUBLIC_GOOGLE_MAPS_BROWSER_KEY=
PUBLIC_GOOGLE_MAPS_MAP_ID=
PUBLIC_SITE_URL=http://localhost:4321
```

- [ ] **Step 6: Smoke-check and commit**

```bash
npm test
npm run build
git add -A
git commit -m "chore: scaffold Astro SSR app with Vitest"
```

Expected: Vitest finds 0 tests (exit 0 or “no tests”); build succeeds.

---

### Task 2: Env helper + pure geo utilities (TDD)

**Files:**
- Create: `src/lib/env.ts`, `src/lib/geo/haversine.ts`, `src/lib/geo/pick-destination.ts`, `tests/pick-destination.test.ts`

**Interfaces:**
- Produces:
  - `requireEnv(name: keyof ImportMetaEnv): string` — throws if missing/empty
  - `haversineMeters(a: LatLng, b: LatLng): number`
  - `pickDestinationListingId(startId: string, points: Array<{ id: string; lat: number; lng: number }>): string`

- [ ] **Step 1: Write failing tests for destination picking**

```ts
// tests/pick-destination.test.ts
import { describe, expect, it } from 'vitest';
import { pickDestinationListingId } from '../src/lib/geo/pick-destination';

describe('pickDestinationListingId', () => {
  it('picks farthest geodesic from start; ties break by lowest id', () => {
    const start = { id: 's', lat: 0, lng: 0 };
    const near = { id: 'b', lat: 0.01, lng: 0 };
    const far = { id: 'a', lat: 1, lng: 0 };
    const alsoFar = { id: 'c', lat: 1, lng: 0 };
    expect(
      pickDestinationListingId(start.id, [start, near, far, alsoFar]),
    ).toBe('a');
  });

  it('throws when fewer than 2 points besides incomplete sets', () => {
    expect(() =>
      pickDestinationListingId('s', [{ id: 's', lat: 0, lng: 0 }]),
    ).toThrow(/at least 2/i);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/pick-destination.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement haversine + pickDestination**

```ts
// src/lib/geo/haversine.ts
export type LatLng = { lat: number; lng: number };

const R = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

```ts
// src/lib/geo/pick-destination.ts
import { haversineMeters } from './haversine';

export function pickDestinationListingId(
  startId: string,
  points: Array<{ id: string; lat: number; lng: number }>,
): string {
  const start = points.find((p) => p.id === startId);
  if (!start) throw new Error('Start listing not in points');
  const others = points.filter((p) => p.id !== startId);
  if (others.length < 1) throw new Error('Optimize requires at least 2 geocoded stops');

  let best = others[0]!;
  let bestDist = haversineMeters(start, best);
  for (const p of others.slice(1)) {
    const d = haversineMeters(start, p);
    if (d > bestDist || (d === bestDist && p.id < best.id)) {
      best = p;
      bestDist = d;
    }
  }
  return best.id;
}
```

```ts
// src/lib/env.ts
export function requireEnv(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/pick-destination.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo src/lib/env.ts tests/pick-destination.test.ts
git commit -m "feat: add destination picker and env helper"
```

---

### Task 3: URL extract + day grouping (TDD)

**Files:**
- Create: `src/lib/listings/url-extract.ts`, `src/lib/listings/day-grouping.ts`, `tests/url-extract.test.ts`, `tests/day-grouping.test.ts`, `tests/fixtures/sample-listing.html`

**Interfaces:**
- Produces:
  - `extractListingFromHtml(html: string, sourceUrl: string): { name: string | null; address: string | null; photoUrl: string | null }`
  - `defaultTourDateFromAppointment(appointmentAt: Date | null, timeZone: string): string | null` — `YYYY-MM-DD` or null
  - `assertSameTourDate(dates: string[]): void` — throws if mixed dates

- [ ] **Step 1: Write failing URL extract tests**

```ts
// tests/url-extract.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractListingFromHtml } from '../src/lib/listings/url-extract';

describe('extractListingFromHtml', () => {
  it('reads og:title, og:image, and postal address when present', () => {
    const html = readFileSync('tests/fixtures/sample-listing.html', 'utf8');
    const result = extractListingFromHtml(html, 'https://example.com/listing/1');
    expect(result).toEqual({
      name: '123 Main St Listing',
      address: '123 Main St, Springfield, IL 62701',
      photoUrl: 'https://cdn.example.com/photo.jpg',
    });
  });

  it('returns nulls when tags missing — never invents', () => {
    expect(extractListingFromHtml('<html></html>', 'https://example.com')).toEqual({
      name: null,
      address: null,
      photoUrl: null,
    });
  });
});
```

Fixture `tests/fixtures/sample-listing.html`:

```html
<html><head>
<meta property="og:title" content="123 Main St Listing" />
<meta property="og:image" content="https://cdn.example.com/photo.jpg" />
<meta property="og:description" content="Nice place" />
</head><body>
<address itemprop="address">123 Main St, Springfield, IL 62701</address>
</body></html>
```

- [ ] **Step 2: Write failing day-grouping tests**

```ts
// tests/day-grouping.test.ts
import { describe, expect, it } from 'vitest';
import {
  assertSameTourDate,
  defaultTourDateFromAppointment,
} from '../src/lib/listings/day-grouping';

describe('defaultTourDateFromAppointment', () => {
  it('returns null when no appointment', () => {
    expect(defaultTourDateFromAppointment(null, 'America/New_York')).toBeNull();
  });

  it('formats calendar date in workspace timezone', () => {
    const d = new Date('2026-08-21T22:00:00Z');
    expect(defaultTourDateFromAppointment(d, 'America/New_York')).toBe('2026-08-21');
  });
});

describe('assertSameTourDate', () => {
  it('allows empty or single date', () => {
    expect(() => assertSameTourDate([])).not.toThrow();
    expect(() => assertSameTourDate(['2026-08-21'])).not.toThrow();
  });

  it('throws when dates differ', () => {
    expect(() => assertSameTourDate(['2026-08-21', '2026-08-22'])).toThrow(/same day/i);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npm test -- tests/url-extract.test.ts tests/day-grouping.test.ts
```

- [ ] **Step 4: Implement extract + grouping**

```ts
// src/lib/listings/url-extract.ts
export type ExtractedListing = {
  name: string | null;
  address: string | null;
  photoUrl: string | null;
};

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    'i',
  );
  return html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null;
}

export function extractListingFromHtml(html: string, _sourceUrl: string): ExtractedListing {
  const name = metaContent(html, 'og:title');
  const photoUrl = metaContent(html, 'og:image');
  const addressMatch =
    html.match(/<address[^>]*itemprop=["']address["'][^>]*>([^<]+)<\/address>/i) ??
    html.match(/<address[^>]*>([^<]+)<\/address>/i);
  const address = addressMatch?.[1]?.trim() || null;
  return {
    name: name?.trim() || null,
    address,
    photoUrl: photoUrl?.trim() || null,
  };
}
```

```ts
// src/lib/listings/day-grouping.ts
export function defaultTourDateFromAppointment(
  appointmentAt: Date | null,
  timeZone: string,
): string | null {
  if (!appointmentAt) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(appointmentAt);
}

export function assertSameTourDate(dates: string[]): void {
  const unique = [...new Set(dates.filter(Boolean))];
  if (unique.length > 1) {
    throw new Error('All stops on a route must share the same tour day');
  }
}
```

- [ ] **Step 5: Run tests — expect PASS; commit**

```bash
npm test
git add src/lib/listings tests
git commit -m "feat: URL extract and tour day grouping helpers"
```

---

### Task 4: Optimize request builder (TDD)

**Files:**
- Create: `src/lib/google/optimize-request.ts`, `tests/optimize-request.test.ts`

**Interfaces:**
- Consumes: `pickDestinationListingId`
- Produces: `buildOptimizeWaypointRequest(input: OptimizeInput): OptimizeRequestBody` where body matches Routes API `computeRoutes` JSON (origin, destination, intermediates, `travelMode: 'DRIVE'`, `optimizeWaypointOrder: true`)

```ts
export type OptimizeStop = { id: string; lat: number; lng: number; isStart: boolean };

export type OptimizeRequestBody = {
  origin: { location: { latLng: { latitude: number; longitude: number } } };
  destination: { location: { latLng: { latitude: number; longitude: number } } };
  intermediates: Array<{ location: { latLng: { latitude: number; longitude: number } } }>;
  travelMode: 'DRIVE';
  optimizeWaypointOrder: true;
};

export type OptimizePlan = {
  body: OptimizeRequestBody;
  originId: string;
  destinationId: string;
  intermediateIds: string[];
};
```

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildOptimizePlan } from '../src/lib/google/optimize-request';

describe('buildOptimizePlan', () => {
  it('sets origin to start, destination to farthest, intermediates the rest', () => {
    const plan = buildOptimizePlan([
      { id: 's', lat: 0, lng: 0, isStart: true },
      { id: 'near', lat: 0.01, lng: 0, isStart: false },
      { id: 'far', lat: 1, lng: 0, isStart: false },
    ]);
    expect(plan.originId).toBe('s');
    expect(plan.destinationId).toBe('far');
    expect(plan.intermediateIds).toEqual(['near']);
    expect(plan.body.travelMode).toBe('DRIVE');
    expect(plan.body.optimizeWaypointOrder).toBe(true);
  });

  it('throws without exactly one start', () => {
    expect(() =>
      buildOptimizePlan([
        { id: 'a', lat: 0, lng: 0, isStart: false },
        { id: 'b', lat: 1, lng: 0, isStart: false },
      ]),
    ).toThrow(/start/i);
  });
});
```

- [ ] **Step 2: Implement `buildOptimizePlan`; run tests; commit**

```ts
// src/lib/google/optimize-request.ts
import { pickDestinationListingId } from '../geo/pick-destination';

export type OptimizeStop = {
  id: string;
  lat: number;
  lng: number;
  isStart: boolean;
};

function latLng(p: { lat: number; lng: number }) {
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

export function buildOptimizePlan(stops: OptimizeStop[]) {
  const starts = stops.filter((s) => s.isStart);
  if (starts.length !== 1) throw new Error('Exactly one start listing is required');
  if (stops.length < 2) throw new Error('Optimize requires at least 2 geocoded stops');

  const origin = starts[0]!;
  const destinationId = pickDestinationListingId(
    origin.id,
    stops.map(({ id, lat, lng }) => ({ id, lat, lng })),
  );
  const destination = stops.find((s) => s.id === destinationId)!;
  const intermediateIds = stops
    .filter((s) => s.id !== origin.id && s.id !== destinationId)
    .map((s) => s.id);

  return {
    originId: origin.id,
    destinationId,
    intermediateIds,
    body: {
      origin: latLng(origin),
      destination: latLng(destination),
      intermediates: intermediateIds.map((id) => latLng(stops.find((s) => s.id === id)!)),
      travelMode: 'DRIVE' as const,
      optimizeWaypointOrder: true as const,
    },
  };
}
```

```bash
npm test
git add src/lib/google tests/optimize-request.test.ts
git commit -m "feat: build Google Routes optimize request plan"
```

---

### Task 5: Supabase schema + RLS

**Files:**
- Create: `supabase/migrations/20260821000000_init.sql`, `src/lib/types/database.ts` (hand-written minimal types matching tables)

**Interfaces:**
- Produces: SQL migration creating `profiles`, `workspaces`, `workspace_members`, `listings`, `tour_days`, `tour_stops`, storage bucket `listing-photos`, RLS policies, trigger to create profile + workspace on signup

- [ ] **Step 1: Write migration SQL**

Include:

- `profiles(id uuid PK references auth.users, display_name text)`
- `workspaces(id uuid PK, name text, invite_token_hash text not null, created_at timestamptz)`
- `workspace_members(workspace_id, user_id, role text check in ('owner','member'), PK(workspace_id,user_id))`
- `listings(...)` per spec; `appointment_at timestamptz null`; `lat double precision null`; `lng double precision null`
- `tour_days(workspace_id, tour_date date, label text null)`
- `tour_stops(tour_day_id, listing_id, is_start boolean default false, sort_order int null, leg_duration_sec int null, leg_distance_m int null, unique(tour_day_id, listing_id))`
- Helper `is_workspace_member(ws uuid)` security definer
- RLS: members select/insert/update/delete workspace-scoped rows
- On `auth.users` insert: create profile; create workspace named 'Household'; hash a random invite token (store hash); insert owner membership. Prefer generating invite token in app on first settings view if DB trigger cannot return raw token — **v1 approach:** workspace created with placeholder hash; `/app/settings` rotates invite via API and shows raw token once in URL `PUBLIC_SITE_URL/invite/{token}`.

- [ ] **Step 2: Document apply steps in commit message body / brief `docs/agents` note is NOT required; put apply instructions in plan only:**

```bash
# User/agent applies via Supabase CLI or SQL editor when credentials exist:
supabase db push
# or paste migration into Supabase SQL editor
```

- [ ] **Step 3: Commit migration + types**

```bash
git add supabase src/lib/types
git commit -m "feat: add Supabase init migration and DB types"
```

**Stop if Supabase project is not configured:** do not invent local fake auth. Continue Task 6 code against types; runtime verification waits on real project URL/keys in `.env`.

---

### Task 6: Supabase clients, middleware, auth pages

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`, `src/pages/login.astro`, `src/pages/signup.astro`, `src/pages/app/index.astro`

**Interfaces:**
- Produces: `createSupabaseServerClient(cookies)` ; middleware refreshes session; unauthenticated `/app/*` redirects to `/login`

- [ ] **Step 1: Implement server/browser clients using `@supabase/ssr` cookie pattern for Astro**
- [ ] **Step 2: Middleware protects `/app`**
- [ ] **Step 3: Signup/login forms POST to Supabase Auth email+password; on signup ensure workspace membership exists (call `ensureWorkspaceForUser` server helper that creates workspace + owner row if none)**
- [ ] **Step 4: Manual note: requires `PUBLIC_SUPABASE_*` in `.env`**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: Supabase auth clients, middleware, login/signup"
```

---

### Task 7: Invite link join

**Files:**
- Create: `src/lib/crypto/invite-token.ts`, `src/pages/invite/[token].astro`, `src/pages/app/settings.astro`, `src/pages/api/workspace/invite-rotate.ts`

**Interfaces:**
- Produces: `generateInviteToken(): { raw: string; hash: string }` using `crypto.randomBytes` + SHA-256 hex hash
- Settings shows `PUBLIC_SITE_URL/invite/{raw}` after rotate
- Invite page: if logged out → redirect login with return URL; if logged in → insert membership `member` when hash matches; invalid → visible error

- [ ] **Step 1: Implement token helpers + rotate API + settings UI + accept page**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat: workspace invite links"
```

---

### Task 8: Listings CRUD + photos + geocode API

**Files:**
- Create: listing pages, `src/pages/api/listings/*.ts`, `src/components/ListingForm.astro`, `src/components/ListingBadges.astro`, `src/lib/google/geocode.ts`

**Interfaces:**
- Produces: `geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null>` — returns null on zero results (no invented coords); throws if `GOOGLE_MAPS_API_KEY` missing
- Create/update listing; optional Storage upload to `listing-photos/{workspace}/{id}`; geocode after address save when address present

- [ ] **Step 1: Implement geocode client (server-only fetch to Geocoding API)**
- [ ] **Step 2: Implement create/update/geocode endpoints with membership checks**
- [ ] **Step 3: Build listings UI with badges: Needs address / Needs geocode / No photo**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: listings CRUD, photos, and geocoding"
```

---

### Task 9: URL import API

**Files:**
- Create: `src/pages/api/listings/import-url.ts`

**Interfaces:**
- Consumes: `extractListingFromHtml`
- POST `{ url: string }` → fetch with 8s timeout, max 1.5MB, `Content-Type` must include `text/html`; on failure return `{ name:null, address:null, photoUrl:null, sourceUrl }` without crashing; never invent fields

- [ ] **Step 1: Implement endpoint**
- [ ] **Step 2: Wire “Import from URL” on new listing form (fills fields client-side; user saves)**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: best-effort listing URL import"
```

---

### Task 10: Tour days, stops, optimize + promote scratch

**Files:**
- Create: tour pages, `src/pages/api/tours/*.ts`, `src/lib/google/routes.ts`, `src/pages/app/unscheduled.astro`

**Interfaces:**
- Produces: `computeOptimizedRoute(plan: OptimizePlan): Promise<{ orderedIds: string[]; legs: Array<{ durationSec: number; distanceM: number }> }>` using Routes API; field mask must include `routes.optimizedIntermediateWaypointIndex`, `routes.legs.duration`, `routes.legs.distanceMeters`
- `POST /api/tours/optimize` body: `{ tourDayId }` or `{ scratchListingIds: string[], startListingId }`
- Scratch: returns order+legs JSON only
- `POST /api/tours/promote-scratch` body: `{ tourDate, listingIdsInOrder, startListingId, legs }` → creates `tour_days` + `tour_stops`
- Assign listing to day; set-start clears other `is_start` on that day
- Reject optimize if any stop lacks lat/lng or start missing

- [ ] **Step 1: Implement Routes client + optimize/promote/assign/set-start APIs**
- [ ] **Step 2: Unscheduled page: select start, scratch optimize, promote with date input**
- [ ] **Step 3: Tour day page: list stops, optimize, show ETAs**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: tour days, scratch optimize, and Routes integration"
```

---

### Task 11: Map island

**Files:**
- Create: `src/components/map/TourMap.tsx` (or `.ts` vanilla island if React not added — **prefer vanilla JS island** `TourMap.ts` to avoid React dependency unless already present)
- Modify: tour + unscheduled pages to mount map

**Interfaces:**
- Props/data attributes: JSON of `{ id, name, lat, lng, photoUrl, sortOrder, legDurationSec }[]` + browser key + mapId
- Renders Advanced Markers (photo when URL present); draws route polyline if encoded polyline returned — if v1 skips polyline, still show numbered markers by `sortOrder`
- **v1 map:** numbered markers + sidebar ETAs sufficient; optional polyline if Routes returns `polyline.encodedPolyline` and we request it in field mask

- [ ] **Step 1: Add `npx astro add react --yes` only if using TSX; otherwise implement `TourMap.client.ts` vanilla island**
- [ ] **Step 2: Load Maps JS with `PUBLIC_GOOGLE_MAPS_BROWSER_KEY` and `PUBLIC_GOOGLE_MAPS_MAP_ID`**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: Google Map island for tour stops"
```

---

### Task 12: End-to-end smoke checklist + README

**Files:**
- Create: `README.md` (setup: Supabase migration, Google APIs enablement, env vars, `npm run dev`)

- [ ] **Step 1: Write README with exact enable APIs: Maps JavaScript API, Geocoding API, Routes API**
- [ ] **Step 2: Run `npm test` && `npm run build`**
- [ ] **Step 3: Manual smoke (when `.env` real):** signup → invite → listing → geocode → scratch optimize → save tour → map/ETAs
- [ ] **Step 4: Commit**

```bash
git commit -m "docs: README and setup for real estate mapper v1"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Household workspace + accounts | 6–7 |
| Invite link | 7 |
| Manual listings + photos | 8 |
| URL import, no invented fields | 3, 9 |
| Geocode, fail visible | 8 |
| Unscheduled + scratch optimize | 10 |
| Promote scratch to tour date | 10 |
| Day-scoped tours, no cross-day | 3, 10 |
| Start here + farthest destination | 2, 4, 10 |
| Driving optimize + ETAs | 4, 10 |
| Map with pictures | 11 |
| Env fail-fast | 2, 8, 10 |
| Unit tests extract/grouping/optimize | 2–4 |

## Execution notes

- Apply Supabase migration before smoke testing.
- Create Google Cloud billing account + restrict browser key by HTTP referrer; restrict server key by IP if possible.
- After plan execution, merge `feature/plan-01-real-estate-mapper` → `staging` for review (per repo git workflow).
