# Wayhome — Auto-plan into a date range (spread + merge)

**Date:** 2026-08-26  
**Status:** Approved  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:**  
- `docs/superpowers/specs/2026-08-23-auto-plan-clusters-design.md` (v1 undated clusters)  
- `docs/superpowers/specs/2026-08-24-wayhome-tours-calendar-workspace-design.md`  
- `docs/superpowers/specs/2026-08-26-tour-appointment-times-design.md`

## Problem

Auto-plan today only clusters **unscheduled** geocoded listings by proximity and leaves **date assignment to the user**. It ignores geography of stops already on tour days and never merges into existing days. Users want a **tour window** so the app can place all unscheduled listings onto dates in that range, merging with proximate existing days when useful, without packing everything onto one busy day.

## Goals

1. Let the user set a **date range** (inclusive start/end) for Auto-plan fill.
2. Assign **all eligible unscheduled** listings onto days **inside that range** (create days as needed).
3. **Merge** into an existing day in the range when the listing (or cluster) is proximate to that day’s stops.
4. Prefer **spreading** load across days in the range over packing onto the nearest busy day (**choice B**).
5. Leave listings already scheduled (any date) and days **outside** the range untouched.
6. New stops land as **date only** (no invented appointment times).

## Non-goals

- Drive-time / Routes-based clustering (keep haversine + radius/max caps).
- Reshuffling or moving stops already on a day.
- Auto-setting appointment times.
- Replacing calendar drag/Merge/Replace for manual edits.
- Cross-Locale scheduling.

## Decisions

| Topic | Choice |
|-------|--------|
| Window | Required inclusive `start_date` / `end_date` (calendar dates in Locale local sense: `tour_days.tour_date`) |
| Strategy | **Spread first (B)**, then proximity merge |
| Proximity | Same defaults as v1 unless tuned: **3 mi** radius, **max 6** stops per day after merge |
| Already scheduled | Excluded from input; never unassigned by this feature |
| Outside range | Existing tour days outside the window ignored for merge targets and left unchanged |
| Persist | **Preview then confirm** for v1 (show proposed day → listing map; user confirms write) |
| Overflow | If a listing cannot fit any day in range under max-6 + proximity rules → remain **unscheduled** with a visible count/reason (Fail Fast) |

## Algorithm (recommended)

Inputs: locale id, `start_date`, `end_date`.

1. Build the ordered list of dates `D` from start through end (inclusive).
2. Load existing `tour_days` + stops **in `D`** (with listing coords). Days missing from DB are empty slots.
3. Collect **unscheduled** geocoded listings in the Locale (same filter as today’s Auto-plan).
4. **Seed occupancy:** for each date in `D`, note current stop count and geographic centroid (or “nearest-neighbor set”) of existing geocoded stops.
5. **Assign unscheduled listings one at a time** (stable order: e.g. by listing id), each pick:

   **Score candidates among dates in `D` that would still be under max-6 after adding one:**

   - **Spread term (primary):** prefer lower current (or projected) stop count — balance across the window.
   - **Proximity term (secondary):** among ties (or as a soft bonus), prefer dates where the listing is within radius of at least one existing stop on that day (or of the day centroid if the day already has stops). Empty days score neutral on proximity.
   - **Tie-break:** earlier date in range, then listing id.

   Interpretation of **B:** do **not** always glue a listing to the geographically nearest busy day if another day in the window has meaningfully fewer stops. Spread wins; proximity breaks ties / prefers merge when counts are equal.

6. Optionally **batch** remaining listings that never got a proximate merge: run existing `clusterListingsByProximity` on leftovers, then place each cluster onto the **least-loaded** day(s) in `D` that can accept the whole cluster without exceeding max-6 (split cluster only if required by cap — prefer leaving overflow unscheduled over silent split unless product later asks for split).

7. **Preview** proposed assignments (date → listing ids). On confirm, upsert `tour_days` and `tour_stops` (merge; no appointment times); autoroute each touched day via existing optimize path (geo unless that day already has times).

## UX

- Tours Auto-plan (or renamed control): **date range** (two date inputs or week-aligned presets) → **Preview** → **Apply**.
- Preview lists each day in range with current + proposed adds; marks merges vs new days; shows leftover unscheduled count.
- Apply is explicit; Cancel leaves DB unchanged.
- Keep ability to produce undated clusters only? **v1 of this feature supersedes undated-only Auto-plan for the primary button**, or offers “Fill date range” as the primary path and demotes undated clusters. **Recommendation:** primary = fill range; remove or hide undated-only once fill-range ships (Fail Fast: one Auto-plan contract).

## Fail Fast

- Missing/invalid range → error, no writes.
- End before start → error.
- No eligible listings → clear empty state.
- Overflow listings stay unscheduled with an explicit message (how many, why: day full / no proximate day under spread rules).
- No invented coords or times.

## Success criteria

- With two days already holding one listing each inside the range, Auto-plan **does not** strip them; new nearby listings prefer **balancing** onto lighter days, merging when counts tie and proximity allows.
- Days outside the range unchanged.
- Confirm writes merges; preview does not.
- Appointment times on existing stops unchanged; new stops date-only.

## Relationship to v1 Auto-plan

This **extends and largely replaces** undated cluster preview as the main Auto-plan behavior. Core proximity helpers (`clusterListingsByProximity`, radius/max constants) remain reusable for leftover batching.
