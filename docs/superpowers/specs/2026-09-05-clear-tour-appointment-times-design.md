# Wayhome — Clear tour appointment times

**Date:** 2026-09-05  
**Status:** Approved (conversation)  
**Related:** Tours workspace selection toolbar, `/api/tours/appointment-time`

## Problem

Appointment times are easy to set via `<input type="time">` but hard to clear (especially on mobile). Users need clear per stop and for a selection.

## Goals

1. Clear `appointment_time` to null; **keep the stop** on the day.
2. Per listing: explicit clear control next to the time input.
3. Bulk: clear times for **selected stops on the selected day** only.

## Non-goals

- Removing stops from the tour.
- Clearing all timed stops without selection.
- Week / locale-wide clear.

## Decisions

| Topic | Choice |
|-------|--------|
| Clear semantics | `appointment_time = null`, stop stays |
| Bulk scope | Current selection on the day |
| API | Extend appointment-time to accept `listing_ids[]` (one optimize after) |
| Em dash | Forbidden in UI copy |

## UI

- Per stop: icon/button **Clear time** (visible or enabled when a time is set).
- Day toolbar: **Clear times** beside Remove selected; disabled when selection empty.
- After clear: refresh day (same as time change today).
