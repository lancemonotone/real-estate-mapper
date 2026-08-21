# Real Estate Mapper — Design Spec

**Date:** 2026-08-21  
**Status:** Approved in brainstorming; pending user review of this written spec  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  

## Problem

Buyers and renters need an organizational tool to collect property listings (with photos), share them with a household, and plan the most efficient driving route to visit them—especially when appointments fall on different days. This is not an agent CRM.

## Goals (v1)

- Accounts with **household/workspace** sharing (shared listing pool).
- Add listings via **manual entry** and **best-effort URL import** (any URL).
- Map listings with pictures; **driving-only** route optimization.
- **Appointment date/time** fields for organization; **route by calendar day** (different days → different routes).
- **Unscheduled pool** for listings not on a day; allow **scratch optimize** without saving a tour; optional **promote to tour day**.
- Show **estimated drive time between stops** so users can propose viewing times.
- Per tour (or scratch run): user marks one listing as **Start here**.

## Non-goals (v1)

- Soft/hard appointment time windows that reorder stops.
- Walking/transit modes.
- Email invites (invite **links** only).
- Guaranteed scrape success against any listing site.
- Agent/landlord CRM features.
- Invented placeholder photos, addresses, or names when data is missing.

## Approach

**Astro SSR + Supabase + Google Maps Platform**

| Layer | Choice |
|-------|--------|
| App | Astro (SSR) + TypeScript; map as client island |
| Backend | Supabase Auth, Postgres, Storage |
| Map UI | Google Maps JavaScript API (Advanced Markers) |
| Geocode | Google Geocoding API (server) |
| Route | Google Routes API `computeRoutes` with `travelMode: DRIVE` and `optimizeWaypointOrder: true` (server) |

Google secret keys stay on the server. The browser Maps key is restricted by HTTP referrer.

## Architecture

```
Browser (Astro pages + islands)
  ├─ Auth UI (login / signup / invite accept)
  ├─ Listings list + form (manual + URL paste)
  ├─ Tour day planner (unscheduled pool → assign day → mark start)
  ├─ Scratch optimize (unscheduled) + promote to tour day
  └─ Map island (photo pins, ordered route, leg ETAs)

Astro server routes / actions
  ├─ Session + workspace membership checks
  ├─ Listing CRUD + photo upload handoff
  ├─ URL import (fetch → extract → no invented fields)
  ├─ Geocode address
  └─ Optimize (scratch or tour_day)

Supabase
  ├─ Auth (email + password)
  ├─ Postgres (workspaces, members, listings, tour_days, tour_stops)
  └─ Storage (uploaded photos)

Google Maps Platform
  ├─ Maps JavaScript API
  ├─ Geocoding API
  └─ Routes API (optimizeWaypointOrder + leg durations)
```

### Optimize request shape

Google Routes keeps origin and destination fixed and reorders intermediates only. v1 uses an **open path** (no home base):

- **Origin:** the stop marked `is_start`.
- **Destination:** among the other geocoded stops, the one farthest from origin by geodesic distance (tie-break: lowest `listing_id`). This picks a terminal property without a second user gesture.
- **Intermediates:** all remaining geocoded stops (`via` must be false).
- **Flags:** `travelMode: DRIVE`, `optimizeWaypointOrder: true`; request leg duration/distance fields in the field mask.
- **Persist (tour day only):** `sort_order`, `leg_duration_sec`, `leg_distance_m` from the response.
- **Scratch:** keep order + ETAs in UI/session state only until “Save as tour for [date]”.

## Data model

All listing/tour data is workspace-scoped. RLS: only `workspace_members` may read/write.

| Entity | Fields / notes |
|--------|----------------|
| **profiles** | Links to `auth.users`; display name |
| **workspaces** | Household; invite secret stored hashed; raw token only in the invite URL |
| **workspace_members** | `user_id`, `workspace_id`, role (`owner` \| `member`) |
| **listings** | `name`, `address`, `lat`/`lng` (nullable until geocoded), `source_url`, `photo_path` and/or `photo_url`, `appointment_at` (nullable timestamptz), `notes`, `created_by` |
| **tour_days** | `workspace_id`, `tour_date` (date), optional label |
| **tour_stops** | `tour_day_id`, `listing_id`, `is_start`, `sort_order` (nullable until optimized), `leg_duration_sec`, `leg_distance_m` |

### Domain rules

1. On first signup, create a workspace and make the user `owner`.
2. Invite link: logged-in user accepting a valid token joins as `member`.
3. Listings with no tour assignment and treated as undated for routing live in the **unscheduled** pool.
4. If `appointment_at` is set, default assignment date is that calendar date; user may move stops between days.
5. Never put stops from different `tour_date` values on the same optimized route.
6. Optimize requires ≥2 geocoded stops and exactly one `is_start`.
7. Appointment **times** do not reorder stops within a day; they are labels. ETAs between stops help the user choose viewing times.
8. Photos: prefer Storage `photo_path`; keep import `photo_url` when present and no upload yet. No image → no marker image (no stock placeholder).
9. URL import and geocode must not invent missing fields.

## Screens and flows

1. **Sign up / sign in** → workspace home.
2. **Settings**: copy invite link.
3. **Listings**: list with badges for missing address/geocode/photo; add/edit manual + upload; import from URL → partial form → save.
4. **Unscheduled pool**: manage undated/unassigned listings; mark start; **scratch optimize**; optionally **Save as tour for [date]**.
5. **Tour day**: assign listings; mark start; **optimize**; map + ordered list + leg ETAs + total drive time.

## Error handling

| Case | Behavior |
|------|----------|
| URL import partial | Save allowed; empty fields remain empty |
| Geocode fails | No lat/lng; “Needs geocode”; excluded from optimize until fixed |
| Optimize preconditions fail | Visible error; keep prior saved order if any |
| Routes API error | Visible error; no fake polyline/ETAs |
| Photo upload / dead URL | No image; no placeholder |
| Bad invite | Clear error; no membership |
| Missing env keys | Fail on the action that needs them |

## Stack and config

- Astro SSR + TypeScript
- `@supabase/supabase-js` (server session pattern appropriate to Astro)
- Env: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only as needed), `GOOGLE_MAPS_API_KEY` (server), `PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, Map ID for Advanced Markers as required by Google
- Deploy host undecided; design assumes standard Node/serverless Astro adapter + env vars

## Testing

- **Unit:** URL extract helpers with HTML fixtures (fields or empty; never fabricate).
- **Unit:** Day grouping (appointment date → default day; no cross-day merge).
- **Unit/integration:** Optimize request shaping and parsing of optimized order + leg durations (mock Google).
- **Manual smoke:** signup → invite join → listing → geocode → scratch optimize → save tour day → map shows order + ETAs.

Do not rely on live listing-site scrapes or live Google billing in CI.

## Implementation notes for later planning

- Prefer server Actions or dedicated API routes for import, geocode, and optimize.
- Cache geocode results on the listing row; do not re-geocode unchanged addresses without cause.
- Respect Google Maps Platform quotas and enable only Maps JS, Geocoding, and Routes APIs.
- URL import: timeout, size limit, and allowlist of content types; treat extractor failures as empty extraction, not app crash.
