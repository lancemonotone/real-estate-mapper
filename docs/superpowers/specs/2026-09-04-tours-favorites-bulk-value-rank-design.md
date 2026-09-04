# Wayhome — Tours favorites, bulk unschedule, value rank

**Date:** 2026-09-04  
**Status:** Approved  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:**  
- `docs/superpowers/specs/2026-08-24-wayhome-tours-calendar-workspace-design.md`  
- `docs/superpowers/specs/2026-08-26-auto-plan-date-range-design.md`  
- `docs/superpowers/specs/2026-08-26-tour-appointment-times-design.md`

## Problem

1. Auto-plan fills from **all** unscheduled listings; users often want **favorites only**, and still want a Tours display filter like Compare/Travel.
2. Clearing a tour day requires removing stops one-by-one; the day-dot can be dragged but **cannot drop** onto Unscheduled.
3. There is no locale page that ranks listings by **value** (Total/mo vs sq ft vs move-in cash).

## Goals

1. **Auto-plan favorites checkbox** — when checked, preview/apply (and that flow’s map of proposed set) use only `is_favorite` unscheduled geocoded listings.
2. **Tours heart display filter** — same mental model as Compare/Travel; show/hide non-favorites in Unscheduled + day list + locale map pins. Does **not** change Auto-plan.
3. **Bulk selection UX** — keep row select (Ctrl/Cmd toggle; optional Shift-range); detail links unchanged; add Select all / Clear / Remove selected on the day panel.
4. **Day-dot → Unscheduled** — drop clears **date-only** stops (`appointment_time` null); **keeps** timed stops; toast explains outcome. Manual remove (and Remove selected) may still remove timed stops.
5. **Value rank page** — default sort by **$/sqft** ascending (`Total/mo ÷ sqft`); columns Total/mo, Move-in, Sq ft, $/sqft; favorites heart filter; optional sort mode “lowest move-in.” No hidden weighted score in v1.
6. **Toast (not confirm modals)** for questionable outcomes (partial clear, nothing to clear, bulk remove summary, etc.).
7. Ship in **Astro on a feature branch from `staging`**; pure helpers in `src/lib/` for later Next port. Each feature PR notes a **Next port checklist**.

## Non-goals

- Parallel implementation on `feature/plan-nextjs-migration`.
- Checkboxes for listing selection.
- Confirm dialogs for day clear / bulk remove.
- Opaque multi-factor weighted score (sliders later if needed).
- Inventing Total/mo or sqft zeros for incomplete listings (exclude from $/sqft score).

## Decisions

| Topic | Choice |
|-------|--------|
| Favorites ×2 | Distinct: Auto-plan checkbox (plan input) vs heart filter (display only) |
| Selection | Row chrome Ctrl/Cmd; Shift-range; Select all / Clear / Remove selected; title link still opens detail |
| Day-dot drop | Unassign untimed only; toast; no modal |
| Remove selected | Unassigns selected ids including timed (explicit multi-manual) |
| Value default | `$/sqft` ascending; second mode lowest move-in |
| Toast policy | Prefer toast over confirm for these actions |

## Listing / stop states (unchanged)

| State | `appointment_time` | Day-dot clear |
|-------|--------------------|---------------|
| Date only | null | Cleared |
| Date + time | set | Kept |

## Next port

After merge to `staging`, checklist per feature: lib helpers, API route shapes, client scripts → React ports, locale nav entry for value page. Do not land on Next until that branch can absorb `staging`.

## Plans

1. `docs/superpowers/plans/2026-09-04-tours-favorites-filters.md`
2. `docs/superpowers/plans/2026-09-04-tours-bulk-unschedule.md`
3. `docs/superpowers/plans/2026-09-04-listings-value-rank.md`
