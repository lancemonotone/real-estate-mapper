# Wayhome — Tours Drive overview

**Date:** 2026-09-05  
**Status:** Approved (conversation)  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:**  
- `src/pages/app/locales/[localeId]/tours/index.astro`  
- `src/lib/tours/tour-day-drive-total.ts`  
- `src/lib/proximity/maps-url.ts`

## Problem

On a tour day, the edit UI (reorder, times, map) is not ideal for driving. Users need a phone-friendly sequence: day total, Open in Maps, and per-stop Call / Navigate.

## Goals

1. Separate **Drive** page for a tour day (not the edit workspace).
2. Sticky header: date, stop count, drive total / Needs route, primary **Open in Maps**.
3. Per stop: number, name, appointment time if set, address, **Call** (if phone), **Navigate** (from previous point).
4. Between stops: leg meta `~N min · X.X mi` when stored legs exist.
5. Fail Fast: no invented phones, coords, or waypoint overflow.

## Non-goals

- Editing stops, times, or route on the Drive page.
- Live Directions API on this page.
- Clearing appointment times (follow-up feature).

## Decisions

| Topic | Choice |
|-------|--------|
| Route | `/app/locales/[localeId]/tours/[id]/drive` |
| Entry | **Drive** button on Tours workspace selected-day header |
| Maps | Full-day Open in Maps **and** per-stop Navigate + Call |
| Density | Stop essentials + trip meta (not beds/rent) |
| Waypoints | Google Maps URL max **9** intermediate waypoints; over → show explicit error, no link |
| Stale route | Header: Needs route; Navigate to coords still OK |
| Em dash | Forbidden in UI copy |

## Behavior

### Open in Maps

Build origin → waypoints → destination from custom start (if set), listing stops with coords (tour order), custom end (if set). Omit points missing lat/lng. If fewer than 2 points, omit Open in Maps. If intermediate waypoints > 9, show message: too many stops for one Maps link.

### Per-stop Navigate

Directions from previous route point (custom start or prior listing with coords) to this stop. If no previous point or this stop lacks coords, omit Navigate.

### Call

`tel:` when listing has phone; otherwise omit Call.

## Follow-up (out of scope)

Clear appointment times per listing and in bulk.
