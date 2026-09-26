# Demo visitor (synthetic session) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (always inline; do not ask subagent vs inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let portfolio visitors enter via `/login?v=<token>`, see login theater, browse as a synthetic Demo visitor with optimistic routine edits and fail-closed durable writes against live Nest data.

**Architecture:** Env token + HMAC-signed HTTP-only `wayhome_demo` cookie; middleware admits demo to `/app` with a service-role Supabase client scoped to `DEMO_NEST_ID`; every mutating/paid API calls `forbidDemoMutation`; client sets `data-demo` and short-circuits routine fetches (Briefboard pattern), toasting on `demo_readonly`.

**Tech Stack:** Astro 7 SSR, `@supabase/ssr` + service-role `createClient`, Node `crypto` (HMAC), vitest, vanilla JS in `public/scripts` + `src/client`.

**Spec:** `docs/superpowers/specs/2026-09-25-demo-visitor-design.md`

## Global Constraints

- No DB migrations.
- Fail Fast / fail closed on writes: demo must never mutate durable state or spend Google Places/geocode/proximity refresh.
- No em dashes in user-facing copy (`Demo · changes won’t save`, `Demo · not saved`).
- Do not create `auth.users` / `profiles` / `nest_members` rows for demo.
- Real login without `?v=` unchanged; logged-in real sessions ignore `v`.
- Hash never grants agent API powers; agent mutators still call forbid when demo cookie present.
- Plan scope only: no rusmiller.com edits; no demo seed dataset.
- Branch: `feature/demo-visitor` (already created from staging).
- CSS: follow `responsive-css` skill (mobile-first, logical properties, native nesting) when editing styles.
- Prefer Vitest for pure demo helpers; end-to-end checklist in `docs/demo-visitor.md`.

---

## File map

| File | Responsibility |
|------|----------------|
| `.env.example` | Document `DEMO_VISITOR_TOKEN`, `DEMO_NEST_ID`, `DEMO_SESSION_SECRET` |
| `src/env.d.ts` | Env + `App.Locals` (`isDemo`, `demoNestId`) |
| `src/lib/demo/constants.ts` | Cookie name, display name, synthetic user id, error code |
| `src/lib/demo/session.ts` | Sign/verify cookie, attempt login, clear cookie, `isDemoSession` |
| `src/lib/demo/forbid.ts` | `forbidDemoMutation` → 403 JSON |
| `src/lib/demo/nest.ts` | `resolveDemoNestId`, `requireDemoNestId` |
| `src/lib/supabase/admin.ts` | Service-role client from `SUPABASE_SECRET_KEY` |
| `src/middleware.ts` | Real user OR demo cookie for `/app`; attach locals for `/api` without redirect |
| `src/pages/api/auth/demo-start.ts` | POST: verify token, set cookie, redirect `/app` |
| `src/pages/api/auth/logout.ts` | Also clear `wayhome_demo` |
| `src/pages/login.astro` + login client script | Theater when `?v=` matches |
| `src/layouts/AppLayout.astro` | Banner chip, `data-demo`, Demo visitor chrome |
| `src/styles/chrome.css` (or small addition) | Subtle demo banner |
| `public/scripts/demo.js` | `isDemoSession`, toast, fetch helpers |
| Client scripts (`listing-form-autosave`, `listing-favorite`, tours/proximity/settings) | Short-circuit routine / toast destructive |
| Mutating `src/pages/api/**` (+ `places/photo` GET) | Call `forbidDemoMutation` early |
| App pages using `getPrimaryNestId` / `ensureNestForUser` | Demo nest short-circuit |
| `docs/demo-visitor.md` | Owner note: param, env, entry URL, checklist |
| `tests/demo-session.test.ts` | Cookie sign/verify + constant-time token check |

---

### Task 1: Demo session helpers + Vitest

**Files:**
- Create: `src/lib/demo/constants.ts`
- Create: `src/lib/demo/session.ts`
- Create: `tests/demo-session.test.ts`
- Modify: `.env.example`
- Modify: `src/env.d.ts`

**Interfaces:**
- Produces:
  - `DEMO_COOKIE_NAME = 'wayhome_demo'`
  - `DEMO_DISPLAY_NAME = 'Demo visitor'`
  - `DEMO_USER_ID = '00000000-0000-4000-8000-0000000000de'`
  - `DEMO_READONLY_CODE = 'demo_readonly'`
  - `signDemoCookie(payload, secret): string`
  - `verifyDemoCookie(value, secret): { nestId: string; exp: number } | null`
  - `tokensMatch(expected: string, provided: string): boolean` (empty expected → false)
  - Cookie payload: `v=1`, `nestId`, `exp` (unix seconds), HMAC-SHA256 hex

- [ ] **Step 1: Write failing tests**

```ts
// tests/demo-session.test.ts
import { describe, expect, it } from 'vitest';
import {
  signDemoCookie,
  tokensMatch,
  verifyDemoCookie,
} from '../src/lib/demo/session';

describe('tokensMatch', () => {
  it('rejects empty expected', () => {
    expect(tokensMatch('', 'abc')).toBe(false);
  });
  it('accepts equal tokens', () => {
    expect(tokensMatch('secret-token', 'secret-token')).toBe(true);
  });
  it('rejects mismatched tokens', () => {
    expect(tokensMatch('secret-token', 'other')).toBe(false);
  });
});

describe('demo cookie', () => {
  const secret = 'test-session-secret-at-least-16';
  it('round-trips nestId', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const raw = signDemoCookie(
      { nestId: '571e710b-10a2-412f-9ddb-740923168397', exp },
      secret,
    );
    const parsed = verifyDemoCookie(raw, secret);
    expect(parsed?.nestId).toBe('571e710b-10a2-412f-9ddb-740923168397');
  });
  it('rejects tampered payload', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const raw = signDemoCookie(
      { nestId: '571e710b-10a2-412f-9ddb-740923168397', exp },
      secret,
    );
    expect(verifyDemoCookie(raw + 'x', secret)).toBeNull();
  });
  it('rejects expired cookie', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const raw = signDemoCookie(
      { nestId: '571e710b-10a2-412f-9ddb-740923168397', exp },
      secret,
    );
    expect(verifyDemoCookie(raw, secret)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests (expect FAIL)**

Run: `npm test -- tests/demo-session.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement constants + session**

`src/lib/demo/constants.ts`:

```ts
export const DEMO_COOKIE_NAME = 'wayhome_demo';
export const DEMO_DISPLAY_NAME = 'Demo visitor';
export const DEMO_USER_ID = '00000000-0000-4000-8000-0000000000de';
export const DEMO_READONLY_CODE = 'demo_readonly';
export const DEMO_READONLY_MESSAGE = 'Demo · not saved';
export const DEMO_BANNER_TEXT = 'Demo · changes won’t save';
/** Cookie lifetime: 12 hours */
export const DEMO_SESSION_TTL_SECONDS = 12 * 60 * 60;
```

`src/lib/demo/session.ts` — use `node:crypto` `createHmac`, `timingSafeEqual`. Format cookie value as `base64url(payloadJson).signatureHex`. `tokensMatch`: if `expected` empty return false; else timing-safe compare of buffers (pad/length-check first).

- [ ] **Step 4: Run tests (expect PASS)**

Run: `npm test -- tests/demo-session.test.ts`
Expected: PASS

- [ ] **Step 5: Env types + example**

Add to `.env.example`:

```bash
# Portfolio demo visitor (?v= on /login). Empty = disabled.
DEMO_VISITOR_TOKEN=
DEMO_NEST_ID=
DEMO_SESSION_SECRET=
```

Extend `ImportMetaEnv` and `App.Locals`:

```ts
isDemo?: boolean;
demoNestId?: string;
```

Keep existing `user` / `supabase` / `profile` fields.

- [ ] **Step 6: Commit**

```bash
git add src/lib/demo tests/demo-session.test.ts .env.example src/env.d.ts
git commit -m "feat(demo): add signed session helpers and tests"
```

---

### Task 2: Service-role client, forbid helper, middleware

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/demo/forbid.ts`
- Create: `src/lib/demo/nest.ts`
- Create: `src/lib/demo/synthetic-user.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: session helpers, `requireEnv`, optional env readers
- Produces:
  - `createSupabaseAdminClient(): SupabaseClient<Database>`
  - `forbidDemoMutation(locals): Response | null` — if `locals.isDemo`, return `Response.json({ ok: false, error: DEMO_READONLY_MESSAGE, code: DEMO_READONLY_CODE }, { status: 403 })`; else `null`
  - `getDemoVisitorToken(): string` (trim; empty if unset — do not throw)
  - `getDemoSessionSecret(): string | null`
  - `requireDemoNestId(): string` (throws if missing when establishing demo)
  - `createSyntheticDemoUser(): User` (minimal fields: `id: DEMO_USER_ID`, `email: undefined` / empty, `aud: 'authenticated'`, `role: 'authenticated'`, `app_metadata`/`user_metadata` as needed for type)
  - Middleware sets `locals.isDemo`, `locals.demoNestId`, `locals.user`, `locals.supabase` for valid demo

- [ ] **Step 1: Admin client**

```ts
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { requireEnv } from '../env';

export function createSupabaseAdminClient() {
  return createClient<Database>(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 2: forbid + nest + synthetic user**

Implement `forbidDemoMutation`, `requireDemoNestId` reading `DEMO_NEST_ID` via `process.env` / `import.meta.env` without throwing when merely checking feature-off (token empty). Establishing a session requires nest id + session secret + token all non-empty.

- [ ] **Step 3: Rewrite middleware auth gate**

Behavior:

1. Path not `/app` and not `/api` → `next()` unchanged.
2. For `/api` and `/app`:
   - Build cookie client; `getUser()`.
   - If real user → set locals as today (`isDemo` false); for `/app` continue; for `/api` continue without redirect.
   - Else try verify `wayhome_demo` with `DEMO_SESSION_SECRET`. On success → `isDemo=true`, `demoNestId`, synthetic user, admin supabase client, `profile=null`, `devHuntPassPreview=false`.
   - Else if `/app` → redirect `/login?redirect=…`.
   - Else `/api` → `next()` without user (handlers return 401 as today).
3. Never call `ensureNestForUser` in middleware.
4. Prefer real user over demo cookie when both present.

- [ ] **Step 4: Smoke-check types**

Run: `npx tsc --noEmit` if configured, or `npm run build` only if quick; otherwise rely on later tasks. Prefer `npm test` still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/demo src/middleware.ts
git commit -m "feat(demo): middleware admits signed demo sessions"
```

---

### Task 3: demo-start, logout, login theater

**Files:**
- Create: `src/pages/api/auth/demo-start.ts`
- Modify: `src/pages/api/auth/logout.ts`
- Modify: `src/pages/login.astro`
- Create: `src/client/login-demo-theater.ts` (or `public/scripts/login-demo.js`)

**Interfaces:**
- Consumes: `tokensMatch`, `signDemoCookie`, `requireDemoNestId`, `DEMO_*` constants
- Produces: `POST /api/auth/demo-start` body/form `token` → Set-Cookie + redirect `/app` or 401

- [ ] **Step 1: demo-start route**

```ts
// Outline — use formData or JSON { token }
// 1. Read DEMO_VISITOR_TOKEN; if empty → 401
// 2. tokensMatch(expected, token) or 401
// 3. Require DEMO_SESSION_SECRET + DEMO_NEST_ID or 503 fail-closed
// 4. Set HTTP-only Secure SameSite=Lax cookie (Secure in prod), Max-Age = DEMO_SESSION_TTL_SECONDS
// 5. redirect('/app')
```

Do **not** call Supabase Auth.

- [ ] **Step 2: logout clears demo cookie**

After `signOut`, `cookies.delete(DEMO_COOKIE_NAME, { path: '/' })` (match set options).

- [ ] **Step 3: login theater**

In `login.astro` frontmatter:

- If real `user` → redirect (existing); **ignore** `v`.
- Read `v` from searchParams; compute `demoEntryOk = tokensMatch(getDemoVisitorToken(), v)`.
- Pass `demoEntryOk` and the raw `v` only into a client script when true (token already in URL; server confirmed match). Prefer posting token from URL in theater script rather than embedding secret in HTML if avoidable — script reads `URLSearchParams`.

Client (~1.2s): fill email `demo@visitor` and a masked password field with nonsense, then `POST /api/auth/demo-start` with the `v` value (fetch or form). On success follow redirect. On failure show alert text without unlocking real write paths.

Remove `v` from the address bar with `history.replaceState` after starting theater or after success (Briefboard: after success).

- [ ] **Step 4: Manual check**

With env set locally: open `/login?v=<token>` logged out → theater → land `/app` with demo cookie. Without token → normal login form.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/auth src/pages/login.astro src/client/login-demo-theater.ts
git commit -m "feat(demo): login theater and demo-start cookie"
```

---

### Task 4: Nest resolution for demo app pages

**Files:**
- Create: `src/lib/demo/resolve-nest.ts` (or extend `nest.ts`)
- Modify: `src/pages/app/index.astro`
- Modify: `src/pages/app/settings.astro`
- Modify: `src/pages/app/locales/new.astro`
- Modify: `src/pages/app/upgrade.astro`
- Modify: `src/layouts/AppLayout.astro` (entitlement load for demo — treat as `member`, not owner; skip membership row requirement)

**Interfaces:**
- Produces: `resolveAppNestId(locals): Promise<string | null>`  
  - if `locals.isDemo` → `locals.demoNestId` (never `ensureNestForUser`)  
  - else existing `getPrimaryNestId` / optional ensure for real users only

- [ ] **Step 1: Helper**

```ts
export function resolveAppNestId(locals: App.Locals): string | null {
  if (locals.isDemo) return locals.demoNestId ?? null;
  return null; // pages keep async getPrimaryNestId for real users
}
```

Prefer explicit branches in pages:

```ts
let nestId: string | null = Astro.locals.isDemo
  ? (Astro.locals.demoNestId ?? null)
  : await getPrimaryNestId(supabase, user.id);
if (!nestId && !Astro.locals.isDemo) {
  nestId = await ensureNestForUser(supabase, user.id);
}
if (!nestId) {
  // fail visible — redirect login or throw
}
```

- [ ] **Step 2: Entitlement UI for demo**

When `isDemo`, load billing/snapshot with admin client but set `role: 'member'`, `isOwner: false` without requiring `nest_members` row for `DEMO_USER_ID`. Do not invent Nest member DB rows. Member list may show real members only; header shows Demo visitor.

- [ ] **Step 3: Commit**

```bash
git add src/pages/app src/layouts/AppLayout.astro src/lib/demo
git commit -m "feat(demo): resolve live Nest without ensureNest"
```

---

### Task 5: Server mutation / paid gate (inventory)

**Files:** every mutating route below — add early:

```ts
const denied = forbidDemoMutation(Astro.locals /* or locals */);
if (denied) return denied;
```

For handlers that build their own supabase before locals exist, call after reading `locals` from the APIRoute args. Extend middleware so `/api` populates `locals.isDemo` when cookie valid.

**Inventory (all must forbid; auth logout/demo-start excluded):**

| Route | Notes |
|-------|--------|
| `listings/create.ts`, `update.ts`, `delete.ts`, `favorite.ts`, `passed.ts`, `geocode.ts`, `import-url.ts` | geocode = paid |
| `locales/create.ts`, `update.ts`, `delete.ts`, `preview-place.ts` | preview-place may call Places |
| `places/autocomplete.ts`, `details.ts` | paid |
| `places/photo.ts` (GET) | **allow** — display thumbs for known place ids (design: serving stored proximity UI) |
| `profile/theme.ts`, `borders.ts`, `dev-hunt-pass-preview.ts` | settings-class |
| `proximity/*` mutators + compute/refresh/one-off/criteria writes/exclude/lock/listing-places writes | paid + durable |
| `tours/*` all POST mutators listed in inventory | |
| `agent/listings/[id].ts`, `agent/locales/.../listings` POST/PUT/PATCH | defense in depth |

**Also:** any Astro page `POST` that mutates (e.g. settings invite rotate in `settings.astro`) — gate at start of POST branch with forbid (return toast-friendly page or redirect with query). Prefer moving durable POSTs through APIs that already forbid; if settings invite stays in page POST, call forbid there.

- [ ] **Step 1: Add `forbidDemoMutation` to each file in the inventory** (one PR/commit batch is OK). Unclassified = deny.

- [ ] **Step 2: Grep verification**

Run: `rg -L "forbidDemoMutation" src/pages/api -g "*.ts"` and reconcile: only `auth/logout.ts`, `auth/demo-start.ts`, `tours/optimize.ts` (demo Nest exception), `tours/auto-plan.ts` (read-only preview), `places/photo.ts` (display thumbs), and pure read GETs may omit. Autocomplete/details/proximity/geocode must include.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api src/pages/app/settings.astro
git commit -m "feat(demo): fail-closed mutation and paid API gate"
```

---

### Task 6: Banner, toast, session overlay (client)

**Files:**
- Create: `public/scripts/demo.js`, `public/scripts/demo-overlay.js`
- Modify: `src/layouts/AppLayout.astro`
- Modify: `src/styles/chrome.css` (demo banner / toast styles)
- Modify: writers as needed so demo soft mutations do not hard-reload away the overlay (`tours-calendar.js`, settings theme/borders status)

**Approach (whole app):** one fetch interceptor classifies `/api/**` mutations as `allow` | `routine` | `destructive`. Routine → soft JSON success + `sessionStorage` overlay (theme, borders, reactions, listing fields). Destructive / paid → toast, no network. Soft ClientRouter navigations re-apply overlay; hard refresh clears it.
---

### Task 7: Owner docs + local/prod env values

**Files:**
- Create: `docs/demo-visitor.md`
- Modify: local `.env` (not committed) with generated secrets
- Do **not** commit real tokens

- [ ] **Step 1: Generate secrets**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice: token + session secret. Set in local `.env`:

```bash
DEMO_VISITOR_TOKEN=<hex>
DEMO_SESSION_SECRET=<hex>
DEMO_NEST_ID=571e710b-10a2-412f-9ddb-740923168397
```

- [ ] **Step 2: Write `docs/demo-visitor.md`**

Mirror Briefboard owner doc:

- Param `v`
- Env keys
- Generate command
- Entry URL pattern: `{PUBLIC_SITE_URL}/login?v={DEMO_VISITOR_TOKEN}`
- Local entry URL with the generated token (same as Briefboard documents local URL)
- Prod pattern: `https://wayhome.rusmiller.com/login?v=…` (owner sets Vercel env; do not change Vercel unless asked)
- Manual checklist (5 items from spec)

- [ ] **Step 3: Manual checklist pass locally**

1. Cold `/login?v=…` → theater → demo + banner  
2. `/login` without hash → real auth  
3. Edit listing field → Saved → hard refresh restores  
4. Delete / Places autocomplete → toast; no DB / no spend  
5. Real session + `?v=` → stays real  

- [ ] **Step 4: Commit docs only**

```bash
git add docs/demo-visitor.md
git commit -m "docs: demo visitor entry URL and test checklist"
```

- [ ] **Step 5: Wrap-up for owner**

Reply with the exact local and intended prod entry URLs (token value) so rusmiller.com can be updated by the owner. Do not edit WordPress.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| `?v=` + theater + synthetic session | 3 |
| No auth user row; signed cookie | 1–2 |
| Live Nest reads via service role + `DEMO_NEST_ID` | 2, 4 |
| Client routine optimism; server hard-block | 5–6 |
| Destructive/paid toast `Demo · not saved` | 5–6 |
| Banner `Demo · changes won’t save` | 6 |
| Real session ignores `v` | 3 |
| Owner docs + checklist | 7 |
| No migrations | Global |
| Places spend blocked | 5 (`places/*`, geocode, proximity) |

No TBD placeholders. Cookie/helpers names consistent across tasks (`wayhome_demo`, `forbidDemoMutation`, `demo_readonly`).
