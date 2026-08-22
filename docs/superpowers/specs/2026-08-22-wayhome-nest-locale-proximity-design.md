# Wayhome — Nest, Locale & Proximity Design

**Date:** 2026-08-22  
**Status:** Draft (pending user review)  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Depends on:** `docs/superpowers/specs/2026-08-21-real-estate-mapper-design.md` (v1 tours/listings)

## Problem

Households often evaluate listings in one metro at a time, and care how long it takes to **visit** nearby amenities (beach, park, grocery) or a fixed point (office, school). Today’s flat workspace mixes geography poorly for caching place data, and “closest X” is undefined without Locale-scoped POIs and travel-mode routing.

## Goals

- Rebrand/domain: product **Wayhome**; shared container **Nest**; geographic pool **Locale**.
- Nest holds many Locales; invitees join the Nest and see its Locales.
- Each Locale is one geographic area (center + radius) with listings, tour days, proximity criteria, and a POI cache.
- Proximity: **nearest curated place type** (primary) and **shared fixed pin** (secondary), measured by **travel** time/distance (not crow-flies as the answer).
- Surfaces: Compare matrix + listing map solo explore; lazy compute with persistent result cache.

## Non-goals

- Attribute compare (fees, deposits, amenities, sq ft, pet rent/deposit) — remembered backlog, separate spec.
- Drag-to-calendar scheduling UX — remembered backlog, separate spec.
- Soft appointment windows that reorder tour stops.
- Guaranteed Places quality for every type in every region.
- Cross-Locale routes or shared POI caches across Locales.
- Parallel legacy “workspace listings” model after migration.

## Naming

| Term | Meaning | Replaces / notes |
|------|---------|------------------|
| **Wayhome** | Product name | App branding |
| **Nest** | Shared household; auth + invites | Today’s `workspace` |
| **Locale** | One geographic hunt: area, listings, tours, proximity | New |
| **Proximity criterion** | Saved Locale metric: type or pin + travel mode | New |
| **POI cache** | Places of curated types in the Locale area | New |
| **Proximity result** | Cached listing × criterion travel outcome | New |

## Domain model

```
Nest (members via invites)
  └─ Locale[] (center, radius, name)
       ├─ listings, tour_days, tour_stops (v1 behavior, Locale-scoped)
       ├─ proximity_criteria[]
       ├─ locale_pois[]          (POI cache)
       └─ proximity_results[]    (listing × criterion)
```

### Entities (additive / rename)

| Entity | Fields / notes |
|--------|----------------|
| **nests** | Renamed from `workspaces`; invite secret hashed; members unchanged in role (`owner` \| `member`) |
| **nest_members** | Renamed from `workspace_members` |
| **locales** | `nest_id`, `name`, `center_lat`/`center_lng`, `radius_m`, optional `center_label`, timestamps |
| **listings** | Add `locale_id`; remove direct nest-only listing pool (nest is reached via locale) |
| **tour_days** | `locale_id` required (Nest reached via Locale); stops still reference listings in that Locale |
| **proximity_criteria** | `locale_id`, `label`, `kind` (`place_type` \| `fixed_pin`), `place_type_key` (nullable), `pin_lat`/`pin_lng`/`pin_place_id`/`pin_name` (nullable), `travel_mode` (`DRIVE` \| `WALK` \| `BICYCLE` \| `TRANSIT`), `sort_order` |
| **locale_pois** | `locale_id`, `place_type_key`, Google `place_id`, `name`, `lat`/`lng`, fetch metadata |
| **proximity_results** | `listing_id`, `criterion_id`, `status` (`ok` \| `needs_geocode` \| `no_place` \| `error`), `place_id`/`place_name`/`place_lat`/`place_lng`, `duration_sec`, `distance_m`, `maps_url`, `computed_at`, `error_message` (nullable) |

### Domain rules

1. Invite accepts into the **Nest**; members may read/write all Locales in that Nest (same sharing model as v1 workspace).
2. A listing belongs to exactly one Locale.
3. Tour optimize never mixes stops across Locales.
4. Locale created with **center + radius**. If a geocoded listing falls outside, **auto-expand** radius (with padding) so the pin fits; expansion refreshes/extends POI cache for types in use.
5. Travel mode is **per criterion**; all listings’ results for that column use that mode.
6. Crow-flies may shortlist candidates only; the stored/shown answer is Routes travel duration (winner) plus distance.
7. Missing geocode, empty POI set, or Routes failure → explicit status; never invent `0` or placeholder places.
8. One-off explore on listing map uses the same compute pipeline. Persist into `proximity_results` only for **saved** criteria (Compare columns). One-off runs may keep the last outcome in UI/session until the user chooses **Save as criterion**; no orphan result rows without a criterion.

## Proximity compute pipeline

### Curated place types (v1 list)

App-maintained keys mapped to Google Place types / search strategy, e.g.:

- Beach, Park, Grocery, School, Gym, Transit station  

Exact Google type mapping and per-type default search radius caps are implementation-plan details; Fail Fast if a type returns nothing in-area.

### POI cache (per Locale)

1. For each curated `place_type_key` used by the Locale’s criteria (or explicitly refreshed): query Google Places over the Locale area.
2. Upsert into `locale_pois`.
3. Refresh triggers: Locale area expand; new criterion type; user “Refresh places.”

### Nearest-of-type (primary)

1. Require listing lat/lng; else `needs_geocode`.
2. Candidates = `locale_pois` for that type; shortlist nearest **N** by geodesic distance to the listing.
3. Routes API matrix (or equivalent batch): listing → candidates, `travelMode` from criterion.
4. Winner = minimum duration; persist duration, distance, place fields, Maps URL; status `ok`.
5. If no candidates → `no_place`. Routes failure → `error` with visible message.
6. **Lazy:** compute on Compare view / listing explore when cell missing or stale; optional per-cell or “Refresh stale.”

### Shared fixed pin (secondary)

1. Criterion or one-off provides pin (place autocomplete or map drop).
2. Skip type POI cache; single Routes call listing → pin with criterion mode.
3. Same result shape and cache rules.

### Cost controls

- Cap **N** candidates routed per listing.
- Cap matrix batch size; no eager recompute of entire Nest on login.
- Invalidate results when listing coords, criterion definition/mode, or relevant POI set changes.

## UI surfaces

### Nest home

- List Locales (name, area summary, listing count).
- Create Locale: name + center + radius.
- Settings/invite remain Nest-scoped.

### Locale hub

- Listings, unscheduled pool, tour days — v1 flows, Locale-scoped.
- Entry points: **Compare** (proximity); later backlog features hang here.

### Compare (proximity matrix)

- Rows = listings; columns = saved proximity criteria.
- Cell = travel time · distance · place name · map link, or explicit empty/error status.
- Add/edit/remove criteria (type + mode, or fixed pin + mode).

### Listing detail + map (solo explore)

- Listing pin; optional winning POI overlay for selected criterion/one-off.
- Run a saved criterion (uses/writes `proximity_results`) or a one-off type/pin + mode (session/UI only until saved).
- **Save as criterion** promotes a one-off into Compare and then persists results normally.

## Migration

1. Rename product copy toward Wayhome; schema: `workspaces` → `nests` (or view/alias strategy in plan).
2. Create `locales`; for each Nest, create one **default Locale**.
3. Derive initial center/radius from existing geocoded listings’ bbox + padding when possible; otherwise require a one-time Locale setup before proximity/POI features.
4. Attach all existing listings and tour days to that Locale.
5. Drop any dual path that keeps listings nest-scoped without a Locale.

## Relationship to v1 tour design

Unchanged within a Locale:

- Driving tour optimize, custom start/end, scratch optimize, appointment labels, Fail Fast on missing geocode/photos.

Changed:

- All listing/tour data is Locale-scoped under a Nest.
- New Google Places usage (server) in addition to Geocoding, Routes, Maps JS.

## Remembered backlog (not in this spec)

- Manual listing attributes + compare (fees, deposits, amenities, sq ft, pet rent, pet deposit).
- List-all-properties + drag onto calendar date for a tour.

These are user-proposed nice-to-haves; not committed until separately designed.

## Testing

- **Unit:** geodesic shortlist; winner-by-duration; Locale expand updates radius; cache invalidation keys.
- **Unit (mocked Google):** Places → `locale_pois`; Routes matrix parse; error → `error` status.
- **Manual smoke:** Nest → two Locales → add beach/drive criterion → Compare fills → listing map one-off pin → save criterion.

Do not call live Places/Routes in CI.

## Implementation notes for later planning

- Prefer server routes/actions for Places fill, matrix compute, Locale expand.
- Enable Places API (New or legacy as chosen in plan) with secret key server-side only.
- Document curated type → Google mapping in code constants, not user-editable freeform types in v1.
- Repo/package rename to Wayhome is optional and out of band unless a later plan names it.
