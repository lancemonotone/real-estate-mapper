# Wayhome — Tours calendar workspace

**Date:** 2026-08-24  
**Status:** Approved  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Supersedes:** `docs/superpowers/specs/2026-08-22-wayhome-tour-calendar-design.md`  
**Related:** `docs/superpowers/specs/2026-08-23-listing-tours-plan-design.md` (listing page + Plan; this spec replaces Plan-as-primary Tours UX with the calendar workspace)

## Problem

Tour planning is split across **Tours** (list + Auto-plan / Plan Route), **`/tours/[id]`** (day edit + map + S/E), and a thin date assign on the listing. Users need one place to see the week, schedule listings, edit a day’s stops, and see the map—without bouncing to a separate day page for every change.

## Goals

1. Make **locale Tours** the calendar workspace: unscheduled rail + week grid + map + selected-day stop list.
2. Use the **same week UI** as the date picker on listing “add to tour.”
3. Drag (and keyboard) to assign, move, reorder; Auto-plan yields **clusters** dragged onto dates.
4. Auto-route days that have stops but no planned route; no separate Plan Route CTA as the main path.
5. Custom start/end via **S / E** controls + place-search overlay; clear with **X**.

## Non-goals

- Hard max stops per day for manual moves (Auto-plan cluster size stays its own limit).
- Soft appointment windows that reorder routes.
- Recurring tours or cross-Locale drag.
- Hard redirect away from `/tours/[id]` in beta (may remain reachable; calendar is primary).
- Soft `?day=` deep-link (optional later).

## Layout (desktop)

Three columns on locale **Tours**:

1. **Unscheduled rail** (collapsible)  
   - Expanded if any unscheduled listings; otherwise collapsed.  
   - Includes **Auto-plan** → produces **clusters** (not dates yet).  
   - Clusters sit in the rail until dragged onto a calendar date.

2. **Week calendar**  
   - Colored circles / stop badges on days that have tours.  
   - Under the grid: **selected day’s stop list** (same behaviors as today’s `/tours/[id]` list: badges, thumbs, hearts, remove, set-as-start → autoroute).  
   - Week paging keeps the selected-day list visible so the user can drag to an off-screen date.

3. **Map**  
   - Nothing selected → locale map (center / radius / listings).  
   - Day selected → that day’s tour map.  
   - Cache route/map when the day is unchanged.  
   - If the day has listings but was never routed → **auto-optimize** on select (or after assign / set-as-start / add / S/E change).

Mobile: stack columns; drag becomes tap-select then tap-day.

## Interaction model

| Action | Meaning |
|--------|---------|
| Click a date | **Select** that day (list + map). Does not move listings. |
| Drag listing(s) / cluster / day-dot | **Move or schedule**. |
| **+** (listing overlay only) | Add **this** listing into the selected day (always merge). |

### Drag targets

- Drop on **empty** date → create tour day + assign.
- Drop on **occupied** date (Tours workspace) → custom overlay (**not** `window.confirm`): **Merge** / **Replace** / **Cancel**.
- Remove last listing from a day → **delete** that tour day.
- Drag listing day → rail → unassign.
- Reorder within the selected-day list.
- Multi-select drag: yes.
- **Day-dot** drag: move entire tour to another date (empty = move; occupied = same Merge / Replace / Cancel).

### Merge / Replace / Cancel

| Choice | Effect |
|--------|--------|
| **Merge** | Keep target stops; add dropped content. Source leaves its prior day; empty source day is deleted. |
| **Replace** | Target day’s existing listings go **back to unscheduled**. Dropped content takes the target day. Source cleared as for Merge. |
| **Cancel** | No change. |

Applies to single listing, multi-select, cluster, and day-dot drops onto an occupied date.

### Keyboard / a11y

- Keyboard assign supported (select listing(s) + select day + assign).
- Small **“i”** info overlay: plain helpful copy (no em dashes; not over-cautious tone).

## Routing (no Plan Route button as primary)

- Day with listings and no planned route → autoroute when selected / after mutation.
- **Set-as-start** → autoroute immediately.
- Add listing → autoroute; **keep saved custom start** if set.
- Cache results when nothing material changed.

## Custom start / end

With a day selected:

- **S** and **E** buttons open a slim overlay (place search, same pattern as today’s start/end fields).
- Save attaches that endpoint and autoroutes.
- **X** on the S/E row clears that endpoint and autoroutes.

## Auto-plan

- Auto-plan groups nearby unassigned listings into **clusters** in the unscheduled rail.
- User **drags a cluster onto a date** to schedule (empty create / occupied → Merge / Replace / Cancel).
- Cluster size limits apply only to Auto-plan; manual scheduling has no hard stop cap.

## Listing “add to tour” overlay

- Same week calendar interface as Tours (dots for existing tour days).
- Click date → select; list below shows that day’s stops.
- **+** (or equivalent) adds **this listing** to the selected day: always **merge**, **no dialog**.
- Empty date → create day + add this listing.
- No day-dot / cluster / multi-set moves in this overlay; Merge / Replace / Cancel never appears here.

## URLs / beta

- Primary UX: locale `/tours`.
- `/tours/[id]` may remain in beta without a hard redirect.
- Optional later: `?day=` soft select.

## Error handling (Fail Fast)

- Missing geocode: assign still allowed; day shows the existing incomplete-coords signal (same as today). Do not invent coordinates.
- API / optimize failures: visible error; do not silently leave a stale “planned” state.
- Occupied-drop dialog is required before Merge/Replace; Cancel leaves state untouched.

## Testing

- Manual: drag listing → empty date; day created; rail updates; map autoroutes.
- Manual: drop on occupied → Merge / Replace / Cancel; Replace returns target listings to unscheduled.
- Manual: day-dot move empty vs occupied.
- Manual: Auto-plan → cluster → drag to date.
- Manual: listing overlay add merges with no dialog.
- Manual: S/E set and clear autoroute; set-as-start autoroutes.
- Unit: date-key / week helpers if extracted; merge/replace state transitions if pure helpers exist.

## Out of scope for first implementation plan (if needed to split)

Prefer one plan unless size forces a cut. If split, ship workspace shell + drag assign first; S/E overlay and day-dot second; listing overlay calendar third—only if the full plan is too large for one pass.
