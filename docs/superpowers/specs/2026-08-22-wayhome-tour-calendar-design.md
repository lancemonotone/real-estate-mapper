# Wayhome — Tour Calendar Assign Design

**Date:** 2026-08-22  
**Status:** Superseded by `docs/superpowers/specs/2026-08-24-wayhome-tours-calendar-workspace-design.md`  
**Depends on:** Locale tours + unscheduled pool + UI chrome  
**Plan:** `docs/superpowers/plans/2026-08-22-wayhome-tour-calendar.md` (historical; use the 2026-08-24 workspace plan when written)

## Problem

Assigning listings to tour days today is form-driven (date inputs). Users want to **see a calendar** and **drag** (or click-drop) unscheduled listings onto a date.

## Goals

- Locale **calendar** view of tour days (month).
- **Unscheduled rail** of listings; drag onto a day → create/assign stop (reuse assign semantics).
- Click a day → open existing tour day (or empty day create).
- Fail Fast: cannot assign geocode-missing listings to optimize later without warning; assign still allowed but day shows badge if any stop lacks coords (same as today).
- Keyboard/click fallback: select listing + select day + Assign (no drag required for a11y).

## Non-goals

- Soft appointment windows that reorder routes.
- Multi-week infinite scroll (month nav is enough).
- Recurring tours.
- Cross-Locale drag.

## UX

1. Locale nav: **Calendar**.
2. Left/top: unscheduled cards (photo thumb + name).
3. Month grid: days with stop count; droppable.
4. Drop → `POST /api/tours/assign` (existing) with `tour_date` + `listing_id` + `locale_id`.
5. After drop, card leaves unscheduled rail; day count increments.
6. Optional: drag from day back to unscheduled = remove stop (if API exists or add `unassign`).

## Technical notes

- Prefer HTML5 drag-and-drop or Pointer Events; no jQuery.
- Glass chrome; calendar cells as glass tiles.
- Mobile: click-to-assign fallback primary (drag optional enhancement).

## Unassign

- Add `POST /api/tours/unassign` if missing: remove `tour_stops` row; if day has zero stops, leave empty `tour_days` row or delete day (prefer **delete empty tour_day** to avoid orphan days).

## Testing

- Manual: drag listing to date; appears on tour; unscheduled updates.
- Manual: click fallback assign.
- Unit: date key helpers if any.
