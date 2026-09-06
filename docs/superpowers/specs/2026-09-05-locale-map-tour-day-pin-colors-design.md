# Wayhome — Locale map pins colored by tour day

**Date:** 2026-09-05  
**Status:** Approved (conversation)  
**Surfaces:** Every `locale-map` with listing pins; week calendar dots; selected-day tour-map stops

## Problem

Mixed listing maps use one pin color, so scheduled days are hard to tell apart at a glance. Tour day chips elsewhere used a single primary, so map colors did not match the calendar.

## Goals

1. Color pins by tour date with a **stable** color per `YYYY-MM-DD` (same date → same color app-wide).
2. Unscheduled listings use a neutral grey pin (`--text-muted`).
3. Week calendar day dots (Tours + listing assign) and selected-day route pins use the same colors.
4. Every `locale-map` listing payload in one pass.

## Non-goals

- Stable weekday hues (Monday always the same) independent of date.
- Changing favorites filter behavior.

## Decisions

| Topic | Choice |
|-------|--------|
| Color key | `tourDayPinColor(date)` from UTC day index `%` palette length |
| Unscheduled | Neutral grey (`--text-muted`) |
| Shape | Same dot / PinElement; color only |
| Legend | On locale-map when any scheduled pin exists: chip + short date |
| Calendar | `.tour-week__dot` / jump dots use the same fill + dark ink |
| Tour map | Selected-day stop pins use that day’s color; S/E stay accent |
| List / drive | Stop-count chip + numbered stop badges use that day’s color; S/E stay accent |
| Em dash | Forbidden in UI copy |

## Data

Map listing JSON includes `tourDate: string | null` (`YYYY-MM-DD`).

## Surfaces

- Locale listing maps (Listings + Tours overview)
- Week calendar dots + month jump dots
- Selected-day tour-map stop pins (`data-tour-date`)
- Day head stop count + stop list badges (Tours, day page, Drive)