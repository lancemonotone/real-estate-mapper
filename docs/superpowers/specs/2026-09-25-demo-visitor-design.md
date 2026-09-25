# Portfolio demo visitor (synthetic session)

Date: 2026-09-25  
Status: approved design → pending implementation on `feature/demo-visitor`

Aligned with Briefboard’s demo visitor (`c/htdocs/briefboard`, same portfolio entry pattern): hash → login theater → synthetic session → client-only routine optimism → server fail-closed on all durable mutations.

## Problem

Portfolio visitors (rusmiller.com) need a one-click path into live Wayhome that shows the real login UX, then lets them browse and simulate edits without durable writes and without creating a visible production Supabase/auth user.

## Goals

1. Hash entry (`?v=<long-token>`) while logged out on `/login` → ~1–1.5s credential theater → synthetic **Demo visitor** session.
2. Reads use existing production Nest/Locale data (current live data is OK; no seed dataset).
3. Routine edit UI succeeds in the client only; refresh restores canonical server data.
4. Destructive / invite / settings / paid Places-class actions fail closed on the server; client shows toast **Demo · not saved**.
5. Persistent chip/banner: **Demo · changes won’t save**.
6. Real Supabase auth without the hash keeps working unchanged; hash never grants agent API or admin powers.
7. Owner docs: param, env keys, entry URL, manual test checklist.

## Non-goals

- Separate demo Nest/dataset or DB migrations
- Editing rusmiller.com (owner updates links when the entry URL is final)
- Session scratch persistence across full page refresh
- A normal user row in `auth.users` / `profiles` / Nest member lists
- Parallel “demo mode” product surface beyond hash entry + synthetic session + banner + soft writes

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Architecture | Signed demo cookie + service-role Nest reads + central mutation gate (Approach 1) |
| Identity | Strict synthetic: no `auth.users` / `profiles` / `nest_members` row |
| Nest data | Fixed env `DEMO_NEST_ID` → existing live Nest (Dunedin Locale) |
| Routine writes | Client-only optimism; never call write APIs; server still hard-blocks |
| Destructive / paid | May call API → `demo_readonly` → toast **Demo · not saved** |
| Paid Google / proximity spend | Blocked (cached/stored results only) |
| Query param | `v` (same as Briefboard) |
| Token config | `DEMO_VISITOR_TOKEN` env (empty = feature off) |
| Migrations | None |

---

## Entry + synthetic session

**Env:** `DEMO_VISITOR_TOKEN` — long random string. Documented in `.env.example` as empty placeholder + comment. Empty/missing → demo entry disabled (`v` ignored).

**When:** Only if the visitor is logged out and `/login` is showing. Matching `v` equal to the configured token (constant-time compare) starts theater. Wrong/missing token → normal login. Already authenticated with a real Supabase session → ignore `v` (do not convert a real session into demo).

**Theater:** ~1–1.5s visible nonsense fill (e.g. email `demo@visitor`, password masked), then auto-submit a dedicated demo login action. The client sends the URL token; the server verifies it against `DEMO_VISITOR_TOKEN` (not real password verification).

**Session principal (Astro `locals` + HTTP-only cookie):**

- Cookie `wayhome_demo` = signed payload (`v=1`, nest id, expiry, HMAC with `DEMO_SESSION_SECRET`)
- `locals.isDemo = true`
- Synthetic user for UI: display name **Demo visitor**; stable id `demo-visitor` (locals only; never written to DB)
- Auth/status exposed to client includes `demo: true` (and display fields the UI needs)
- Middleware treats valid demo cookie as authenticated for `/app` **without** Supabase Auth membership
- Prefer real Supabase user when present; demo cookie alone when logged out

**After success:** `history.replaceState` (or redirect without query) drops `v` from the address bar so refresh does not re-run theater; demo cookie remains.

**Logout:** Clears Supabase cookies and `wayhome_demo`.

**Fail closed:** Missing env, bad signature, expired cookie, or token mismatch → no demo access (normal login / redirect). Never grant write access if demo cannot be established safely.

**Agent API:** Hash never grants Bearer/agent access. Demo session is never a Nest owner/admin for invite or entitlement mutation purposes.

---

## Reads (live Nest data)

**Config:** `DEMO_NEST_ID` pointing at the existing Nest with live Locale data (`571e710b-10a2-412f-9ddb-740923168397`, Locale Dunedin).

**Middleware (`/app`):**

1. Prefer real Supabase user if present.
2. Else valid `wayhome_demo` cookie → demo locals + **service-role** Supabase client (`SUPABASE_SECRET_KEY`).
3. App code for demo always scopes queries to `DEMO_NEST_ID` (never all nests).
4. Invalid/expired demo cookie with no real user → redirect to `/login`.

**Pages:**

- `/app` and Locale routes load the configured Nest’s real listings, tours, and already-stored proximity/photo data.
- Nest member UI may show **Demo visitor** as the current viewer label; do not invent DB member rows.
- Settings remains visible where a normal member can see it; durable writes blocked by the gate.
- `ensureNestForUser` / Nest-create paths must **not** run for demo.

**Paid reads:** New Places autocomplete/details/text, proximity compute/refresh/fill, and geocode that would call Google or write usage counters are **not** free reads; they hit the mutation/paid gate. Serving already-stored proximity results and listing photo URLs remains allowed.

---

## Write gate (server)

**Helpers:** `isDemoSession(locals)` and `forbidDemoMutation(locals)` → `403` with stable `code: 'demo_readonly'` and `error: 'Demo · not saved'` (toast mapping).

**Contract:** Call `forbidDemoMutation` at the start of every durable mutator and every paid Google path so demo fails closed without relying on endpoint memory. Prefer one inventory pass in the implementation plan listing every mutator under `src/pages/api/**` (and any Astro `POST` that mutates).

| Kind | Examples | Demo behavior |
|------|----------|----------------|
| Routine (client) | listing field edits, favorite/passed, tour assign/order, routine prefs | Client short-circuits; **does not** call write APIs. Optimistic UI only. |
| Destructive / settings | delete listing/locale, invite rotate, publish-class, durable profile/settings | Server `403 demo_readonly`; toast **Demo · not saved**. |
| Paid | Places autocomplete/details/text, proximity compute/refresh/fill, geocode | No Google call, no usage counters, no writes; same `demo_readonly` toast. |
| Auth | logout, demo-start | Allowed (session cookie only). |

**Unclassified mutator:** treat as deny (`demo_readonly`), never as a real write.

**No success-echo soft writes** from the server for routine edits (Briefboard alignment).

---

## Client behavior

When auth/demo flag is true:

1. **Banner/chip** always visible: **Demo · changes won’t save**
2. **Routine edits:** do **not** call write APIs; optimistic client state only. Full refresh → server canonical data.
3. **Destructive / invite / settings / paid:** may call API; on `demo_readonly` → toast **Demo · not saved**
4. Account chrome shows **Demo visitor**; hide change-password flows that imply a real account
5. Normal login without hash unchanged; no banner

Reuse existing `.badge` / plan-notice patterns where they fit. No parallel demo product surface.

---

## Docs + verification

**Env (Vercel + local; document in `.env.example`, never commit secrets):**

| Key | Role |
|-----|------|
| `DEMO_VISITOR_TOKEN` | Entry hash; empty = off |
| `DEMO_NEST_ID` | Nest to expose |
| `DEMO_SESSION_SECRET` | HMAC for `wayhome_demo` cookie |
| `SUPABASE_SECRET_KEY` | Demo reads only (already used in scripts) |

**In-repo note:** `docs/demo-visitor.md` (owner-facing):

- Param `v`, env keys, token generate command
- Exact entry URL once token is chosen (also returned to owner in the implementation wrap-up for rusmiller.com links)
- Manual checklist:
  1. Cold start with hash → theater → demo session + banner
  2. Normal login without hash → real user, no banner
  3. Demo routine edit → UI ok → hard refresh restores server data
  4. Destructive / Places-class → toast **Demo · not saved**, nothing durable / no Google spend
  5. Logged-in real session + `?v=` → stays real, no demo kick

**Git:** Implement on `feature/demo-visitor` branched from up-to-date `staging`. No migrations. No rusmiller.com edits.

---

## Out of scope for implementers

- rusmiller.com portfolio HTML/CMS changes
- New demo Nest/seed dataset or Supabase migrations
- Weakening agent listings auth or treating the hash as a substitute for a real session/Bearer token
