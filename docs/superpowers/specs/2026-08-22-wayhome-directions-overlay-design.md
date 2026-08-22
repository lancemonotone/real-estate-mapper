# Wayhome — Directions Overlay Design

**Date:** 2026-08-22  
**Status:** Approved for planning  
**Depends on:** Proximity UI + UI chrome  
**Plan:** `docs/superpowers/plans/2026-08-22-wayhome-directions-overlay.md`

## Problem

Compare “Directions” opens Google Maps in a new tab. Users want the route **in-app** without leaving Wayhome.

## Goals

- Glass **modal overlay** on Compare (and listing proximity explore) showing driving/walk/bike/transit route from **listing origin → winning place**.
- Use Maps JS `DirectionsService` + `DirectionsRenderer` with existing browser key + Map ID.
- Travel mode from the criterion (or one-off).
- Keep an optional “Open in Google Maps” link using the existing directions URL helper.
- Fit chrome: glass dialog, opaque map well inside.

## Non-goals

- Replacing Routes API server compute (overlay is display-only; times still from proximity results).
- Multi-stop tour polyline in this overlay (tour page already has its own map).
- Offline maps / Apple Maps.

## UX

1. Cell (or listing explore) primary control: **Show route** → opens overlay.
2. Overlay: title (listing → place), duration/distance from cached result, map with route, Close, “Open in Google Maps”.
3. Esc / backdrop click closes.
4. If listing or place coords missing → do not open; show existing status text.

## Technical notes

- Client script: `public/scripts/directions-overlay.js`.
- Pass origin/destination/mode via `data-*` or JSON on the trigger.
- Places New ids may need `places/` stripped for Directions `placeId` if used; lat/lng destination is enough when place_id flaky.
- No new Google product beyond Maps JS (already enabled).
