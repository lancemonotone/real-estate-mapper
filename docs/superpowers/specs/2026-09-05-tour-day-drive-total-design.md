# Wayhome — Tour day total drive time

**Date:** 2026-09-05  
**Status:** Approved (conversation)  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:**  
- `src/pages/app/locales/[localeId]/tours/index.astro`  
- `src/lib/tours/optimize-tour-day.ts` (`leg_duration_sec` on stops)  
- `docs/superpowers/specs/2026-08-24-wayhome-tours-calendar-workspace-design.md`

## Problem

On Tours, the selected day shows a stop count but not how long driving between stops will take. Users already pay for route optimize; the per-leg durations are stored but not summarized.

## Goals

1. Show **total drive time** on the **selected day header** (beside the date / stop count).
2. When the day **needs a route**, show a short **Needs route** hint instead of a number (Fail Fast: do not invent a partial total).
3. Use existing stored `leg_duration_sec` values and existing `routeFresh` / `needsAutoroute` signals. No new Directions API call for this label.

## Non-goals

- Drive totals on calendar day cells.
- Persisting a denormalized `total_drive_sec` column on `tour_days`.
- Live client-side recompute of the route just for the label.
- Including appointment dwell / showing time on site.
- Changing optimize / autoroute algorithms.

## Decisions

| Topic | Choice |
|-------|--------|
| Placement | Selected day header only |
| Missing / stale route | Copy: `Needs route` (not a number) |
| Complete route | `~{N} min drive` where N is rounded minutes from sum of non-null `leg_duration_sec` |
| Single stop, no drive segment | Omit the drive meta entirely |
| Source of truth | Sum stop `leg_duration_sec` when `routeFresh`; else if `needsAutoroute` show hint |
| Em dash | Forbidden in UI copy |

## Behavior

### When to show what

Given selected tour day with `selectedStops`:

1. If `needsAutoroute` → show muted `Needs route`.
2. Else if `routeFresh` and sum of non-null `leg_duration_sec` is `> 0` → show `~{minutes} min drive` (`Math.round(sumSec / 60)`, use `1` if sumSec > 0 and round would be 0).
3. Else (one stop / no legs / no durations and no autoroute needed) → show nothing.

### Layout

In `.tours-workspace__day-head`, after the stop-count badge, add muted text:

```html
<p class="muted tours-workspace__day-drive" data-tours-day-drive>
```

### Refresh

After autoroute / optimize, `applyTourDayRoute` updates the map but may not reload the page. That payload should include total drive seconds (or per-stop legs) so the header label can update in place. Prefer including `totalDriveSec` (or leg list) on the optimize response map payload and setting the label text in `applyTourDayRoute`. Soft nav / `reloadForDay` re-renders SSR.

## Implementation sketch

- Pure helper: `src/lib/tours/tour-day-drive-total.ts`
- SSR in `tours/index.astro`
- CSS for `.tours-workspace__day-drive`
- Update optimize response + `applyTourDayRoute` to refresh the label
- Vitest for the helper

## Verification

1. Fresh multi-stop day → `~N min drive`.
2. Stale day → `Needs route`.
3. Single stop, no custom end → no drive meta.
4. Autoroute success updates the label without full reload when possible.
