# Tour appointment times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional confirmed `appointment_time` on tour stops; when any stop on a day is timed, autoroute in fixed clock order (timed first, date-only tail); expose set/clear time in the Tours day stop list.

**Architecture:** Nullable `tour_stops.appointment_time` (`time`). Pure helper orders stops for routing. `optimizeTourDay` chooses geo-optimize (today) vs fixed-order Routes call (`optimizeWaypointOrder: false`). JSON API patches time then autoroutes. Calendar (and day page) show `<input type="time">` per stop.

**Tech Stack:** Astro, Supabase Postgres, Google Routes API, Vitest, vanilla JS in `public/scripts/`.

**Spec:** `docs/superpowers/specs/2026-08-26-tour-appointment-times-design.md`

## Global Constraints

- Fail Fast: no invented times; empty control = null.
- When any time exists, time order wins over geo optimize and over manual reorder of timed stops (date-only tail keeps relative `sort_order`).
- Unscheduled listings unchanged (no stop row).
- No directions-link UI in this plan.
- Branch from `staging`; do not commit unless the user asks.

---

## File map

| File | Role |
|------|------|
| `supabase/migrations/YYYYMMDDHHMMSS_tour_stop_appointment_time.sql` | Add column |
| `src/lib/types/database.ts` | `TourStop.appointment_time` |
| `src/lib/tours/appointment-order.ts` | Order helper |
| `tests/appointment-order.test.ts` | Helper tests |
| `src/lib/google/optimize-request.ts` | `buildFixedOrderPlan` |
| `src/lib/tours/optimize-tour-day.ts` | Branch geo vs fixed |
| `src/pages/api/tours/appointment-time.ts` | PATCH time + autoroute |
| `src/pages/app/locales/[localeId]/tours/index.astro` | Time input in day list |
| `src/pages/app/locales/[localeId]/tours/[id].astro` | Same for parity |
| `public/scripts/tours-calendar.js` | Save time on change |
| `public/scripts/tours-day.js` | Same if day page binds stops |
| `src/styles/chrome.css` | Compact time control styles |

---

### Task 1: Migration + type

**Files:**
- Create: `supabase/migrations/<timestamp>_tour_stop_appointment_time.sql`
- Modify: `src/lib/types/database.ts` (`TourStop`)

- [ ] **Step 1: Add migration**

```sql
alter table public.tour_stops
  add column appointment_time time;

comment on column public.tour_stops.appointment_time is
  'Confirmed local appointment clock time for tour_days.tour_date; null = date only';
```

- [ ] **Step 2: Extend `TourStop`**

Add `appointment_time: string | null` (Supabase returns `HH:MM:SS` or `HH:MM`).

- [ ] **Step 3: Push migration**

Run: `npm run db:push`  
Expected: migration applied on linked project.

---

### Task 2: Appointment order helper (TDD)

**Files:**
- Create: `src/lib/tours/appointment-order.ts`
- Create: `tests/appointment-order.test.ts`

**Produces:** `orderStopsForAutoroute(stops): StopForOrder[]` where each stop has `{ listingId, appointmentTime: string | null, sortOrder: number | null }`.

- [ ] **Step 1: Failing tests**

Cases:
1. All null times → stable by `sortOrder` ascending (nulls last).
2. Mixed → timed ascending by time string (`HH:MM` / `HH:MM:SS`), then untimed by prior `sortOrder`.
3. Equal times → stable by prior `sortOrder`.

- [ ] **Step 2: Implement helper**

Normalize time to minutes past midnight for compare; nulls are untimed.

- [ ] **Step 3: `npm test -- tests/appointment-order.test.ts`** — pass.

---

### Task 3: Fixed-order Routes plan + optimizeTourDay

**Files:**
- Modify: `src/lib/google/optimize-request.ts` — add `buildFixedOrderPlan(stopsInVisitOrder, options)` with `optimizeWaypointOrder: false`, origin = customStart or first listing, destination = customEnd or last listing, intermediates = middle.
- Modify: `src/lib/tours/optimize-tour-day.ts` — select `appointment_time`, `sort_order`; if any time, order via helper then `buildFixedOrderPlan` + `computeOptimizedRoute`; else existing `buildOptimizePlan`.
- Test: extend or add unit test for `buildFixedOrderPlan` body shape if cheap (no network).

**Consumes:** `orderStopsForAutoroute`  
**Produces:** `optimizeTourDay` respects times.

- [ ] **Step 1: Implement `buildFixedOrderPlan`**
- [ ] **Step 2: Wire `optimizeTourDay`**
- [ ] **Step 3: Run existing tour/optimize-related tests if any + appointment-order tests**

---

### Task 4: API `POST /api/tours/appointment-time`

**Files:**
- Create: `src/pages/api/tours/appointment-time.ts`

Body: `{ tour_day_id: string, listing_id: string, appointment_time: string | null }`  
- `appointment_time` null or `""` → clear.  
- Non-null must match `/^\d{2}:\d{2}(:\d{2})?$/`.  
- Verify stop exists via nest membership (same patterns as other tour APIs).  
- Update row; call `optimizeTourDay`; return `{ ok: true, optimized, optimizeError? }` like calendar-action.

- [ ] **Step 1: Implement route**
- [ ] **Step 2: Manual or thin test optional**

---

### Task 5: UI — calendar workspace + day page

**Files:**
- Modify tours `index.astro` stop row: `<input type="time" class="tours-stops__time" data-appointment-time data-listing-id=… value={hhmm or ""} />`
- Modify `tours/[id].astro` similarly
- Modify `tours-calendar.js`: change handler → POST appointment-time → reload or soft refresh like other mutations
- Modify `tours-day.js` if it owns the day list
- Modify `chrome.css`: `.tours-stops__time` compact, extend existing control padding vars

When day has any timed stop, keep drag-reorder enabled for UX but autoroute after mutations already re-applies time order (spec (b)).

- [ ] **Step 1: Markup**
- [ ] **Step 2: Script**
- [ ] **Step 3: Styles (responsive-css skill)**
- [ ] **Step 4: Smoke: set time → order changes; clear all times → geo path again

---

### Task 6: Spec status

- [ ] Mark design spec **Status: Approved**
- [ ] Leave plan checkboxes updated as done during execution

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| `appointment_time` column | 1 |
| Three states via nullability | 1–5 |
| Timed-first + date-only tail order | 2–3 |
| Fixed-order route (no waypoint optimize) | 3 |
| Geo when no times | 3 |
| API set/clear + autoroute | 4 |
| Calendar + day page UI | 5 |
| No invented times | 4–5 |
| Unscheduled unchanged | (no code; no stop row) |
| Directions CTA | out of scope |
