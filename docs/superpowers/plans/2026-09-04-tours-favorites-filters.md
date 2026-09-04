# Tours favorites filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development if the user asks for subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Auto-plan “favorites only” checkbox (affects preview/apply) and a Tours-page heart display filter (show/hide non-favorites; does not affect Auto-plan).

**Architecture:** Server: optional `favoritesOnly` on `buildFillPreview` / auto-plan apply. Client: Auto-plan checkbox in the rail; separate heart toggle reusing Compare/Travel patterns (`data-favorite` on rows + filter script or Tours-specific script). Locale map listings honor the display filter.

**Tech Stack:** Astro, Supabase, Vitest, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-09-04-tours-favorites-bulk-value-rank-design.md`

## Global Constraints

- Two distinct features: plan checkbox ≠ display heart.
- Fail Fast: no favorited unscheduled geocoded listings → clear empty/overflow message; do not invent a pool.
- No em dashes in user-facing copy.
- Branch from `staging`: `feature/tours-favorites-filters`. Commit only if the user asks.
- Next port: docs only. See `docs/superpowers/plans/2026-09-04-next-astro-parity-backlog.md` (fold into the Next migration plan when that branch is edited). Do not implement in Next until scheduled.

## File map

| File | Role |
|------|------|
| `src/lib/tours/fill-date-range-db.ts` | Filter listings by `is_favorite` when `favoritesOnly` |
| `src/pages/api/tours/auto-plan.ts` | Accept `favoritesOnly?: boolean` |
| `src/pages/api/tours/auto-plan-apply.ts` | Same flag; re-plan with same filter |
| `tests/fill-date-range-db-favorites.test.ts` or extend existing | Unit coverage if extractable; else API-level notes |
| `src/pages/app/locales/[localeId]/tours/index.astro` | Checkbox + heart filter control + `data-favorite` on rows |
| `public/scripts/tours-calendar.js` | Pass `favoritesOnly`; wire display filter |
| `public/scripts/tours-favorite-filter.js` (or extend matrix script) | Display filter for Tours lists + map |
| `src/styles/chrome.css` | Minimal layout for checkbox + filter control |

---

### Task 1: Auto-plan favoritesOnly (server)

**Files:**
- Modify: `src/lib/tours/fill-date-range-db.ts`
- Modify: `src/pages/api/tours/auto-plan.ts`
- Modify: `src/pages/api/tours/auto-plan-apply.ts`
- Create or modify: `tests/` covering filter behavior (prefer pure helper if you extract `filterUnscheduledForAutoPlan`)

**Produces:**

```ts
// buildFillPreview(..., { favoritesOnly?: boolean })
// When favoritesOnly: only listings with is_favorite === true enter unscheduled pool
```

- [x] **Step 1:** Select `is_favorite` on listings query; when `favoritesOnly`, filter before geo/assign.
- [x] **Step 2:** Thread `favoritesOnly` from both API routes’ JSON body (default `false`).
- [x] **Step 3:** Add a focused unit test for the filter helper (extract if needed).
- [x] **Step 4:** Run `npm test` for the new/related tests. Expected: PASS.

Note: Vitest currently fails suite-wide in this environment (`Cannot read properties of undefined (reading 'config')` on every test file). Helper + tests are in place; re-run when Vitest is healthy.

---

### Task 2: Auto-plan checkbox UI

**Files:**
- Modify: `src/pages/app/locales/[localeId]/tours/index.astro` — checkbox near Preview/Apply
- Modify: `public/scripts/tours-calendar.js` — include `favoritesOnly: checkbox.checked` on preview/apply fetch bodies

**Copy:** label like `Favorites only` (no em dash).

- [x] **Step 1:** Add checkbox with `data-auto-plan-favorites-only`.
- [x] **Step 2:** Wire preview + apply payloads.
- [ ] **Step 3:** Manual smoke: unchecked = all unscheduled; checked = only hearts; empty favorites toast/hint.

---

### Task 3: Tours display heart filter

**Files:**
- Modify: `tours/index.astro` — heart filter button (same control pattern as Compare: `listing-favorite` + `data-matrix-favorite-filter` or Tours-specific `data-tours-favorite-filter`); `data-favorite="0|1"` on unscheduled + day stop rows; empty hint
- Create or modify: filter script that hides `[data-favorite="0"]` when favorites mode is on; also filter locale map `data-listings` / pin visibility (or rebuild listing JSON client-side from remaining visible ids)
- Modify: `chrome.css` if needed for header placement

**Rules:**
- Does not change Auto-plan checkbox or API.
- Persist mode in `localStorage` (dedicated key e.g. `wayhome:tours-favorite-filter` so Tours can differ from matrix pages, **or** reuse matrix key if product wants sync; prefer **dedicated Tours key** so Compare filter does not surprise Tours).

- [x] **Step 1:** Markup + empty hint.
- [x] **Step 2:** Script: toggle, hide rows, update map pins for unscheduled view.
- [ ] **Step 3:** Smoke: heart filter hides non-favorites; Auto-plan still uses checkbox independently.

---

### Task 4: Next port checklist (docs only)

Add to PR body or issue comment:

- [ ] Port `favoritesOnly` on auto-plan routes
- [ ] Port Tours heart filter + dedicated storage key
- [ ] Map pin filtering parity

---

## Spec coverage

| Spec | Task |
|------|------|
| Auto-plan favorites checkbox | 1–2 |
| Display heart independent | 3 |
| Fail Fast empty favorites | 1–2 |
| Next checklist | 4 |
