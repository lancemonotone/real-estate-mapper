# Wayhome — Auto-plan (proximity clusters) Design

**Date:** 2026-08-23  
**Status:** Approved in conversation  
**Repo:** https://github.com/lancemonotone/real-estate-mapper

## Problem

Users manually pick which unassigned listings share a tour day. Listings that are geographically close should be grouped automatically; dates come after.

## Goals

1. Cluster unassigned, geocoded Locale listings by proximity (near each other).
2. Present undated groups for review.
3. User assigns a calendar date per group, then save creates `tour_days` + `tour_stops`.
4. Route optimize remains a separate per-day step (existing Plan Route / optimize).

## Non-goals

- Drive-time / Routes-based clustering.
- Full calendar month grid / drag-drop (see tour-calendar design).
- Auto-optimize on save.
- Merging into already-assigned tour days in v1.

## Decisions

| Topic | Choice |
|-------|--------|
| Order | **Dates after clusters** |
| Objective | **Spatial proximity**, not time budget |
| Algorithm | Greedy grow-from-seed using haversine; radius + max size caps |
| Defaults | 3 mi radius, max 6 listings per cluster |
| Missing geo | Exclude; Fail Fast message listing how many skipped |
| Appointments | v1: ignore for clustering (follow-up) |
| Save | Create days + stops without legs/polyline; first listing `is_start` |

## UX (Tours → Plan overlay)

1. **Auto-plan** button runs clustering for all unassigned geocoded listings (checkboxes optional filter later).
2. Show groups: listing names + date input each.
3. **Save tour days** requires a date on every group.
4. Redirect to Tours list (or first new day).

Manual Plan (checkbox → Preview route → Save one day) stays as today.
