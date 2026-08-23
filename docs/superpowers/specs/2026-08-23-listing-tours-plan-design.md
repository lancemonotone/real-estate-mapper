# Wayhome — Listing page consolidate + Tours Plan

**Date:** 2026-08-23  
**Status:** Approved for planning  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:** `docs/superpowers/specs/2026-08-22-wayhome-tour-calendar-design.md` (calendar drag-assign remains a later pass; this spec does not implement Calendar)

## Problem

- Locale nav includes **Unscheduled**, a rough page that mixes one-listing assign and bulk route preview (“scratch-optimize”).
- The **listing page** is hard to navigate: Travel Times dominate the hero, Places and Edit are tabs, and tour assign is not first-class.
- Users open a listing to **see it / edit it**, then **assign to a tour day**. Travel tooling should stay on the listing but secondary.

## Goals

1. Remove **Unscheduled** from Locale nav; redirect old URLs into **Tours**.
2. Rebuild the listing page around: **identity + photo/map → tour assign → edit → Travel Times (secondary)**.
3. Move bulk unassigned planning onto **Tours** as **Plan** (Preview route → Save as tour day).
4. Retire user-facing “scratch”, “scratch-optimize”, and “unscheduled pool” copy.

## Non-goals

- Tour **Calendar** month grid / drag-drop (see tour-calendar design).
- Redesigning Locale Travel Times or Attributes matrices.
- Changing optimize/assign API contracts beyond rename-friendly UI wiring.
- Nest-level unscheduled (already redirects to `/app`).

## Decisions (from product)

| Topic | Choice |
|-------|--------|
| Listing primary jobs | See photo/map/basics + edit, then tour assign |
| Travel Times on listing | Keep add/edit in **one secondary section**, not in the hero |
| Bulk Plan | Live on **Tours**; Unscheduled tab goes away |
| Naming | **Plan** / **Preview route** / **Save as tour day** |

## Locale nav

Tabs (order):

1. Listings  
2. Travel Times  
3. Attributes  
4. Tours  

Remove **Unscheduled**.

- `src/pages/app/locales/[localeId]/unscheduled.astro` → redirect to `${base}/tours` (optionally `#plan`).
- Drop `unscheduled` from `LocaleNav` / `locale-nav.ts` section union (or leave type only if unused).

## Listing page layout

Single scrollable page (no Places / Edit tabs).

1. **Header:** listing title + source icon (if URL).  
2. **Hero:** address (and short meta as needed) | photo + map.  
3. **Tour:**  
   - If assigned: link to tour day + date; optional unassign later if API exists.  
   - If not: date input + **Assign** (`POST /api/tours/assign`).  
4. **Edit:** existing `ListingForm` inline (or one clear Edit block)—always reachable without a tab.  
5. **Travel Times (secondary):**  
   - Saved Locale Travel Times rows for this listing + listing-only places (current list UI).  
   - Add flow (nearest type / search) from today’s Places panel.  
   - Not duplicated in the hero.

Appointment/notes can stay in edit fields or a slim meta line under the address—do not recreate a second “info card” that competes with the hero.

## Tours page

1. **Tour days** list (existing).  
2. **Plan** section (content migrated from Unscheduled, cleaned):  
   - Checklist of listings **not** on any `tour_stops` row for this Locale’s tours (same pool semantics as today).  
   - Start: custom address **or** start listing (custom wins).  
   - Optional custom end.  
   - **Preview route** → existing `/api/tours/optimize`.  
   - On success: show a short human summary (ordered stops), not raw JSON as the primary UI; keep Fail Fast errors visible.  
   - **Save as tour day** → existing `/api/tours/promote-scratch` (internal name can stay; UI never says “scratch”).

## Naming (user-facing)

| Use | Avoid |
|-----|--------|
| Plan | Scratch, scratch-optimize, Unscheduled pool |
| Preview route | Optimize (unless in error from API) |
| Save as tour day | Promote scratch |
| Assign | — |

## Technical notes

- Reuse assign / optimize / promote endpoints; no schema change required for this pass.  
- Prefer shared glass/matrix/list patterns already in chrome.  
- No jQuery; no inline script/style in PHP (N/A); keep client scripts in `public/scripts/` if extracted from the current Unscheduled inline block.  
- Fail Fast: missing Maps keys, empty selection, and API errors stay visible.

## Testing

- Manual: Locale nav has no Unscheduled; `/unscheduled` lands on Tours.  
- Manual: Listing — map/photo and edit visible without tabs; Assign puts listing on a day; Travel Times section still add/list.  
- Manual: Tours Plan — preview order, save day, open tour.  
- Smoke: existing optimize/assign APIs unchanged for happy path.

## Open follow-ups (explicitly later)

- Tour Calendar rail (supersedes ad-hoc Plan checklist UX over time).  
- Unassign from listing if not already wired.  
- Richer Preview route map on Tours (optional).
