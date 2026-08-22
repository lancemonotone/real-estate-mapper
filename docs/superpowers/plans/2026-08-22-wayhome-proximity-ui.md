# Wayhome Proximity UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Compare proximity matrix and listing-map solo explore UX on top of the proximity engine APIs.

**Architecture:** Locale-scoped Astro pages call existing `/api/proximity/*` endpoints. Compare renders listings × criteria with lazy compute on load. Listing detail map overlays the winning POI for a saved criterion or a session-only one-off (no `proximity_results` row until Save as criterion).

**Tech Stack:** Astro pages, existing Maps JS listing/tour map patterns, proximity engine APIs.

**Depends on:** Foundation + `2026-08-22-wayhome-proximity-engine.md`  
**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-nest-locale-proximity-design.md`

## Global Constraints

- Cells show time · distance · place name · map link, or explicit status text — never blank fake zeros.
- One-off explore does not write `proximity_results` until criterion is saved.
- No attribute-compare or drag-calendar work in this plan.
- Feature branch: `feature/plan-proximity-ui` from staging (after engine merges).

---

## File structure

```
src/pages/app/locales/[localeId]/
  compare.astro
  listings/[id].astro          # extend with proximity explore panel
public/scripts/
  proximity-compare.js         # lazy compute + criterion form
  listing-proximity.js         # one-off explore + save criterion
src/pages/api/proximity/
  compute-one-off.ts           # returns JSON only; no DB write
```

---

### Task 1: Compare page shell + criterion management

**Files:**
- Create: `src/pages/app/locales/[localeId]/compare.astro`
- Create: `public/scripts/proximity-compare.js`
- Modify: Locale hub nav to link Compare

**Interfaces:**
- Page loads listings + criteria + existing `proximity_results` for the locale
- Form posts to `/api/proximity/criteria` (engine)
- Delete criterion via same API

- [ ] **Step 1: Build Compare table markup** — rows listings, columns criteria; empty cell `data-listing-id` + `data-criterion-id` with status or result fields

- [ ] **Step 2: Criterion form** — kind select (place_type | fixed_pin), type key from `PLACE_TYPE_CATALOG` labels, travel_mode select, pin lat/lng inputs when fixed_pin, label input

- [ ] **Step 3: Wire hub nav**; commit

```bash
git add src/pages/app/locales public/scripts/proximity-compare.js
git commit -m "feat: Compare page shell and criterion management UI"
```

---

### Task 2: Lazy compute on Compare

**Files:**
- Modify: `public/scripts/proximity-compare.js`

- [ ] **Step 1: On load**, for each cell without `ok` result (missing or non-ok without recent compute), `POST /api/proximity/compute` with `{ listing_id, criterion_id }`; update cell DOM with time (format `Xm` / `Xh Ym`), distance miles `distance_m / 1609.34` to 1 decimal, place name, `<a target="_blank" rel="noopener">` maps link; on `needs_geocode` / `no_place` / `error` show status + error_message when present

- [ ] **Step 2: “Refresh stale” button** calls `{ locale_id, refresh_stale: true }` then reloads

- [ ] **Step 3: Commit**

```bash
git add public/scripts/proximity-compare.js
git commit -m "feat: lazy proximity compute on Compare matrix"
```

---

### Task 3: One-off compute API (no persist)

**Files:**
- Create: `src/pages/api/proximity/compute-one-off.ts`
- Reuse: `computeProximityResult` internals extracted so both persisted and ephemeral paths share `src/lib/proximity/compute-core.ts` returning a result object without requiring criterion id for fixed one-offs

**Interfaces:**
```ts
// POST body
type OneOffBody =
  | {
      listing_id: string;
      kind: 'place_type';
      place_type_key: PlaceTypeKey;
      travel_mode: TravelMode;
    }
  | {
      listing_id: string;
      kind: 'fixed_pin';
      pin_lat: number;
      pin_lng: number;
      pin_name?: string;
      travel_mode: TravelMode;
    };

// Response: same shape as proximity_results row fields (status, duration_sec, …) — never inserts
```

- [ ] **Step 1: Extract compute-core; add one-off route**

- [ ] **Step 2: Unit-test core winner path still covered by existing tests**

- [ ] **Step 3: Commit**

```bash
git add src/lib/proximity src/pages/api/proximity/compute-one-off.ts
git commit -m "feat: ephemeral one-off proximity compute API"
```

---

### Task 4: Listing map proximity explore

**Files:**
- Modify: `src/pages/app/locales/[localeId]/listings/[id].astro`
- Create: `public/scripts/listing-proximity.js`
- Extend listing map script or new script: second marker for winning place; optional simple line

- [ ] **Step 1: Panel UI** — choose saved criterion OR one-off type/pin + mode; Run button

- [ ] **Step 2: Saved criterion → `POST /api/proximity/compute`; one-off → `compute-one-off`; render time/distance/name/link; store last one-off in `sessionStorage` key `wayhome:oneoff:${listingId}`

- [ ] **Step 3: Save as criterion** — `POST /api/proximity/criteria` with one-off fields + label; then compute for this listing; redirect or toast to Compare

- [ ] **Step 4: Map overlay** — if result `ok`, add marker at place_lat/lng; fit bounds to listing + place

- [ ] **Step 5: Commit**

```bash
git add src/pages/app/locales public/scripts/listing-proximity.js
git commit -m "feat: listing map proximity explore and save criterion"
```

---

### Task 5: Manual smoke checklist

- [ ] Nest → Locale → Compare: add Beach/DRIVE; cells fill with times or explicit empty statuses
- [ ] Listing map: one-off fixed pin; session shows result; Save as criterion appears on Compare
- [ ] Listing without geocode shows `needs_geocode`
- [ ] Commit none (docs only if you record notes); mark plan tasks complete

---

## Plan self-review

| Spec UI | Task |
|---------|------|
| Compare matrix | 1–2 |
| Criterion CRUD | 1 |
| Listing explore + map | 4 |
| One-off session only | 3–4 |
| Save as criterion | 4 |
| Display time·distance·name·link | 2, 4 |
