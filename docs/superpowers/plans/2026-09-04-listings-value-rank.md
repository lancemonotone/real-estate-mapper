# Listings value rank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development if the user asks for subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New locale page that sorts listings by value: default **$/sqft** ascending (Total/mo ÷ sq ft), with columns Total/mo, Move-in, Sq ft, $/sqft; optional sort “lowest move-in”; favorites heart filter like Compare.

**Architecture:** Pure scoring helpers in `src/lib/listings/` (portable to Next). New Astro page + locale nav entry. Reuse `sumListingMonthlyTotal`, `sumListingMoveInTotal`, matrix favorite filter patterns.

**Tech Stack:** Astro, Supabase, Vitest, vanilla JS (sort toggle client or server query param).

**Spec:** `docs/superpowers/specs/2026-09-04-tours-favorites-bulk-value-rank-design.md`

## Global Constraints

- No hidden multi-weight score in v1.
- Listings missing Total/mo or sqft: excluded from $/sqft ranking (show in an “Incomplete” section or omit with count; Fail Fast: do not treat null as 0). Prefer: ranked table only complete rows; muted count of skipped incomplete.
- No em dashes in UI copy. Prefer title `Value` or `Best value`.
- Branch from `staging`: `feature/listings-value-rank`. Commit only if the user asks.
- Next port: docs only. See `docs/superpowers/plans/2026-09-04-next-astro-parity-backlog.md` (fold into the Next migration plan when that branch is edited). Do not implement in Next until scheduled.

## File map

| File | Role |
|------|------|
| `src/lib/listings/value-rank.ts` | `dollarsPerSqft`, sort comparators |
| `tests/value-rank.test.ts` | TDD |
| `src/lib/ui/locale-nav.ts` | Add section id e.g. `value` |
| Locale nav component / labels | Link to new page |
| `src/pages/app/locales/[localeId]/value.astro` (or `best-value.astro`) | Page |
| `public/scripts/matrix-favorite-filter.js` | Works if table uses same `data-favorite` hooks |
| `src/styles/chrome.css` | Only if needed beyond matrix styles |

---

### Task 1: Pure value helpers (TDD)

**Files:**
- Create: `src/lib/listings/value-rank.ts`
- Create: `tests/value-rank.test.ts`

**Produces:**

```ts
export function dollarsPerSqft(monthlyTotal: number, sqft: number): number | null;
// null if monthlyTotal or sqft not finite or sqft <= 0

export function compareByDollarsPerSqftAsc(a: { dpsf: number }, b: { dpsf: number }): number;

export function compareByMoveInAsc(a: { moveIn: number }, b: { moveIn: number }): number;
```

- [ ] **Step 1:** Failing tests (null sqft, zero sqft, normal rank order).
- [ ] **Step 2:** Implement helpers.
- [ ] **Step 3:** `npm test` — PASS.

---

### Task 2: Locale nav + page

**Files:**
- Modify: `src/lib/ui/locale-nav.ts` — add `'value'` to `LocaleNavSection`
- Modify: wherever nav links are defined (search `compare` / `travel` href builders) — add `Value` → `${base}/value`
- Create: `src/pages/app/locales/[localeId]/value.astro`

Page behavior:
- Load listings with cost + sqft + `is_favorite` (same fields as Compare).
- Compute `monthlyTotal`, `moveInTotal`, `dpsf` via helpers.
- Default order: complete rows by `dpsf` ascending.
- Sort control: `Best $/sqft` | `Lowest move-in` (query `?sort=dpsf|movein` or client sort).
- Columns: listing name (link), Total/mo, Move-in, Sq ft, $/sqft.
- Heart filter button + `data-favorite` rows (reuse matrix favorite filter script).
- Incomplete count: e.g. `Skipped N listings missing Total/mo or sq ft.`

- [ ] **Step 1:** Nav type + link.
- [ ] **Step 2:** Page SSR table + sort.
- [ ] **Step 3:** Favorites filter smoke.
- [ ] **Step 4:** Manual smoke with known fixture numbers.

---

### Task 3: Next port checklist

- [ ] Port `value-rank.ts` helpers
- [ ] Port `/value` page + nav section
- [ ] Favorites filter parity

---

## Spec coverage

| Spec | Task |
|------|------|
| $/sqft default | 1–2 |
| Columns + move-in mode | 2 |
| Favorites filter | 2 |
| No invented zeros | 1–2 |
| Next checklist | 3 |
