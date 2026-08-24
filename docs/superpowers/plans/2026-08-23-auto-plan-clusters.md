# Auto-plan proximity clusters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cluster unassigned geocoded listings by proximity, let the user pick a date per cluster, and save multiple tour days.

**Architecture:** Pure TS cluster helper (haversine greedy) + `POST /api/tours/auto-plan` (preview) + `POST /api/tours/auto-plan-save` (persist). Tours Plan overlay gains an Auto-plan panel; no Routes calls until the user optimizes a day later.

**Tech Stack:** Astro SSR, Vitest, Supabase `tour_days` / `tour_stops`, existing haversine helper.

## Global Constraints

- Fail Fast: no invented coords; skip ungeocoded listings and say so.
- Dates after clusters; spatial proximity only.
- Defaults: 3 mi radius, max 6 per cluster (named constants).
- No jQuery; client logic in `public/scripts/`.
- Plan scope only: this feature; do not redesign manual Plan.

---

### Task 1: `clusterListingsByProximity` (TDD)

**Files:**
- Create: `src/lib/tours/cluster-listings.ts`
- Create: `tests/cluster-listings.test.ts`

- [x] Write failing tests: empty → []; far points → singleton clusters; nearby within radius → one cluster; over max → split; stable ordering
- [x] Implement greedy seed-grow with `haversineMeters`
- [x] Export `AUTO_PLAN_RADIUS_MILES`, `AUTO_PLAN_MAX_PER_CLUSTER`, `milesToMeters` usage via existing geo helper if present

### Task 2: Preview + save APIs

**Files:**
- Create: `src/pages/api/tours/auto-plan.ts`
- Create: `src/pages/api/tours/auto-plan-save.ts`

- [x] `POST auto-plan` `{ localeId }` → unassigned geocoded clusters + skipped count
- [x] `POST auto-plan-save` `{ localeId, groups: [{ tourDate, listingIds }] }` → upsert days, insert stops, first listing `is_start`
- [x] Reject empty groups, missing dates, listings already assigned, cross-locale

### Task 3: Plan overlay UI

**Files:**
- Modify: `src/pages/app/locales/[localeId]/tours/index.astro`
- Modify: `public/scripts/tours-plan.js`
- Modify: `src/styles/chrome.css` (minimal Auto-plan panel styles)

- [x] Auto-plan button + results panel (groups + date inputs)
- [x] Save tour days → reload Tours
- [x] Keep existing manual Plan flow

### Task 4: Verify

- [x] `npm test` (cluster tests + suite)
- [ ] Manual: clear tour stops → Auto-plan → dates → save → open days
