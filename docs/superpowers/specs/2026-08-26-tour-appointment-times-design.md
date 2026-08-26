# Wayhome — Tour stop appointment times

**Date:** 2026-08-26  
**Status:** Approved  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:** `docs/superpowers/specs/2026-08-24-wayhome-tours-calendar-workspace-design.md`  
**Revises:** Calendar workspace non-goal “Soft appointment windows that reorder routes” — this spec replaces that deferral with an explicit three-state model and time-ordered autoroute.

## Problem

Users schedule listings onto a day via Auto-plan clusters and calendar drag, then confirm appointment times with properties later. Today a stop is date-only: there is no place to record a confirmed time, and autoroute always optimizes for short drive (Google waypoint reorder). Tour-day directions need a stable stop order that can follow confirmed times.

## Goals

1. Model each listing as **unscheduled**, **date only**, or **date + time**.
2. Let nest members set / clear a confirmed appointment time on a stop from the Tours day list (primary UX).
3. When a day has any timed stop, **autoroute in fixed time order** (not geo-optimize reorder).
4. Keep unscheduled listings out of that day’s list, map, polyline, and future directions link.
5. Fit the existing calendar autoroute contract (no primary Plan Route CTA).

## Non-goals

- Soft “windows” or preferred ranges that partially reorder (single confirmed clock time only).
- Invented default times.
- Requiring every stop to have a time before the day is usable.
- Directions-link product UI (polyline/order must be ready for it; shipping the link can be a follow-up).
- Recurring appointments or cross-Locale times.
- Changing Auto-plan cluster logic.

## Listing / stop states

| State | Meaning | Storage |
|-------|---------|---------|
| **Unscheduled** | Not on any tour day | No `tour_stops` row |
| **Date only** | On a day; time not confirmed | `tour_stops` row, `appointment_time` null |
| **Date + time** | On a day; slot confirmed | `tour_stops` row, `appointment_time` set |

Scheduling (drag / assign / Auto-plan drop) moves unscheduled → date only. Setting a time moves date only → date + time. Clearing the time moves back to date only. Unassign / remove last stop returns to unscheduled (and may delete the empty day), same as today.

## Data model

- Add nullable `appointment_time` on `public.tour_stops` (Postgres `time` without time zone, or minutes-past-midnight integer — prefer `time`; interpret in the nest’s local calendar date already on `tour_days.tour_date`).
- No day-level start time in v1.
- Clearing or deleting a stop clears its time with the row (cascade / delete).

## Routing

Primary Tours already autoroutes after select / assign / reorder / set-as-start / S·E changes. Appointment edits are another mutation that triggers the same path.

| Day composition | Autoroute behavior |
|-----------------|-------------------|
| Zero stops | N/A |
| All stops **date only** (no times) | Current behavior: geo optimize (may reorder stops) |
| **Any** stop has a time | **Fixed order**: timed stops ascending by `appointment_time`, then date-only stops after, preserving their previous relative order among themselves. Compute legs/polyline along that sequence (**do not** ask Google to reorder waypoints). |
| Last time on the day cleared | Fall back to geo optimize |

Manual drag-reorder on a day that already has times: either (a) treat reorder as temporary until the next time-based autoroute, or (b) prefer time order as source of truth whenever any time exists. **Recommendation: (b)** — when any time exists, order is derived from times + date-only tail; manual reorder of timed stops is disallowed or immediately overwritten on save. Date-only tail may still be manually reordered relative to each other.

Custom S/E endpoints remain as today: wrap the ordered listing path.

## UI

- Selected-day stop list (calendar workspace): each stop shows time or an empty control (“Add time” / time input). Set and clear without leaving the day.
- Same field on `/tours/[id]` if that page remains reachable, for parity.
- Empty time = date only (visible absence; no placeholder clock).
- Optional later: show times on calendar day chrome; not required for v1.

## Directions readiness

- Directions (follow-up) consume current `sort_order` + encoded polyline for the day.
- Unscheduled listings never appear.
- Mixed timed + date-only days are valid: date-only trail the timed block.
- Optional later “ready for tour day” gate: require all stops timed before offering the directions CTA. **Out of scope for v1.**

## Fail Fast

- Do not invent appointment times.
- Do not silently keep geo-optimized order when times exist.
- Surface autoroute errors the same way as today’s calendar optimize failures.

## Success criteria

- Can assign a cluster to a day with no times; day geo-autoroutes as today.
- Can set times on some stops; day reorders timed-first and rebuilds the route in that order.
- Untimed stops on that day remain on the tour after the timed block.
- Unscheduled listings stay in the rail and off the route.
- Clearing all times restores geo-optimize behavior.

## Implementation notes (non-binding)

Likely touch points: migration + `TourStop` type; stop list markup/scripts on Tours calendar; API to patch `appointment_time`; split or extend `optimizeTourDay` / Routes call into geo-optimize vs fixed-order path; tests for ordering helper (timed ascending + date-only tail).
