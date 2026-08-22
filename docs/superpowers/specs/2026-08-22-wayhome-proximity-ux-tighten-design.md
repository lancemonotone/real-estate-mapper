# Wayhome — Proximity UX tighten

**Date:** 2026-08-22  
**Status:** Approved  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Plan:** `docs/superpowers/plans/2026-08-22-wayhome-proximity-ux-tighten.md`  
**Supersedes (UX / persistence only):** parts of `docs/superpowers/specs/2026-08-22-wayhome-nest-locale-proximity-design.md` (§ UI surfaces, one-off persistence, fixed-pin entry). Engine rules (POI cache, Routes winner, Fail Fast) stay unless noted.  
**Depends on:** Nest/Locale proximity engine already shipped.

## Problem

Proximity explore works technically but the product language and persistence model confuse people:

- **“Saved criterion”** sounds like “save this beach for this listing,” but it only adds a Locale-wide Compare column and re-auto-picks nearest per listing.
- Chosen top‑N candidates and one-offs live in **sessionStorage**, so returning to a listing loses the pick.
- **Fixed pin** entry is raw lat/lng — unusable when Google place/address search exists.
- Listing-private places and Locale-shared Compare questions are not separate concepts in the UI.

## Goals

- Clear mental model: **Compare columns** (Locale) vs **Saved for this listing** (private).
- Persist chosen places: listing-private list + optional **lock** on a Compare cell.
- Replace lat/lng pin entry with **Google place / address search**.
- Two explicit actions after a find: **Use for this listing** | **Add to Compare**.
- Locks stick until unlock; recompute refreshes time/distance to the locked place only.

## Non-goals

- Soft “nearer beach available” hints.
- Showing listing-private places on the Compare matrix.
- Attribute compare, tour calendar, or Places quality guarantees.
- Renaming DB table `proximity_criteria` (UI copy only; schema may add columns/tables).

## Naming (user-facing)

| Term | Meaning |
|------|---------|
| **Compare column** | Locale-wide question on Compare (was “criterion”) |
| **Nearest …** | Column kind: auto closest curated type + travel mode |
| **Shared place** | Column kind: one Google-resolved place for every listing |
| **Saved for this listing** | Private places on that listing only (not on Compare) |
| **Lock** | This listing’s cell for a Nearest column keeps the chosen place |

Retired in UI: criterion, one-off, Save as criterion, fixed pin (as a label), lat/lng entry fields.

## Domain model

```
Locale
  ├─ proximity_criteria[]     → Compare columns (UI name)
  │     kind: place_type | fixed_pin (internal; UI: Nearest | Shared place)
  ├─ proximity_results[]      → listing × column cells
  │     + locked: boolean
  └─ listings[]
        └─ listing_places[]   → private saved places (new)
```

### `listing_places` (new)

Per listing: Google `place_id`, `name`, `lat`/`lng`, `travel_mode`, optional `label`, `duration_sec` / `distance_m` / `maps_url` (cached route from listing), timestamps.  
Not tied to a Compare column. Never appear as Compare columns.

### `proximity_results.locked` (new)

- `locked = true`: place fields are authoritative; refresh/recompute **only** re-routes listing → that place (same travel mode as column). Never swap to another POI.
- Unlock: clear lock; next compute may auto-pick nearest again (Nearest columns) or keep Shared place destination (Shared place columns are inherently “same place,” not per-listing locks — locks apply to **Nearest** cells where the user overrode the auto winner).

### Shared place columns

Still stored as `kind = fixed_pin` with `pin_*` / `pin_place_id` filled via place search (no manual lat/lng UI). Same pin for all listings.

## Flows

### Listing explore

1. Choose **Nearest type** or **Search place** (+ travel mode).
2. Run find → candidates if needed → route overlay as today.
3. Actions:
   - **Use for this listing** → upsert into `listing_places` (and show in Saved list).
   - **Add to Compare** → create or reuse a Locale column (Nearest: same `place_type_key` + travel mode; Shared place: same `place_id` + travel mode); write this listing’s `proximity_results` cell; for Nearest, set **`locked = true`** so the chosen place sticks. If reusing, prompt only when creating a new column label is required (reuse is silent).
4. User may do one or both actions.

### Return to listing

- Load **Saved for this listing** from DB.
- Show locked Compare cells for this listing (e.g. “Beach · locked”) with unlock.
- No dependence on sessionStorage for persistence (session cache optional for in-progress explore only).

### Compare page

- Copy: Compare columns; add Nearest (type + mode) or Shared place (search + mode).
- Matrix: only Locale columns. Locked cells show a lock badge; unlock from cell or listing.
- Lazy fill: unlocked Nearest cells use existing auto-winner pipeline; locked cells refresh route only; Shared place routes every listing to the column’s place.

## UI surfaces

### Listing proximity panel

- Modes: Nearest type | Search place (Places Autocomplete / place search — no lat/lng).
- Post-find actions: Use for this listing | Add to Compare.
- Section: **Saved for this listing** (name · time · distance · open route · remove).
- Locked Compare bindings listed with unlock.

### Compare

- Add/edit/remove columns; Shared place via search.
- Cell content: time · distance · place · route; locked badge when applicable.

## Place search

- Use Google Places (Autocomplete and/or Text) to resolve address or place name → `place_id` + coordinates + display name.
- Fail Fast on search/resolve failure; do not invent coordinates.

## Errors

Missing geocode, empty POI set, search/resolve failure, Routes failure → explicit status. Never invent places or zero travel times.

## Migration / compatibility

- Existing `place_type` columns keep working; UI labels change to Compare column / Nearest.
- Remove lat/lng pin forms; Shared place uses search.
- Clear or ignore session-only one-off as the source of truth after this ships.
- Backfill: no automatic locks; existing results remain unlocked until the user chooses a place.

## Testing

- Unit: lock flag prevents place swap on recompute; unlock restores auto path; listing_places CRUD shape.
- Manual: search → Use for this listing → reload listing; explore beach → Add to Compare → lock visible on Compare; Shared place column via search; no lat/lng fields in UI.

## Implementation notes

- Prefer server routes for resolve + persist; browser Autocomplete may use the public Maps key with Places library if already enabled — verify in plan.
- Keep Fail Fast; curated types unchanged (beach = Nearby `beach`, etc.).
- Plan should include copy pass on Compare + listing scripts/pages.
