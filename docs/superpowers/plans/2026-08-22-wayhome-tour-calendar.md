# Wayhome Tour Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Locale month calendar with unscheduled rail and drag/click assign to tour days.

**Architecture:** New calendar page loads unscheduled listings + tour_days/stops for the month; client DnD calls existing assign API; add unassign API for reverse drag.

**Tech Stack:** Astro, vanilla JS DnD, chrome CSS, existing tours assign.

**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-tour-calendar-design.md`

## Global Constraints

- No worktrees; `staging` only.
- Reuse `/api/tours/assign`; add unassign rather than inventing parallel paths.
- Accessible click fallback required.
- Fail Fast: no fake listings on calendar.

---

### Task 1: Unassign API

**Files:**
- Create: `src/pages/api/tours/unassign.ts`
- Test manually or thin unit if pure helpers

- [ ] **Step 1: POST** `{ locale_id, listing_id, tour_date? }` or `{ stop_id }` — remove stop; delete tour_day if empty
- [ ] **Step 2: Commit** `feat: tour stop unassign API`

---

### Task 2: Calendar page shell

**Files:**
- Create: `src/pages/app/locales/[localeId]/calendar.astro`
- Modify: Locale hub nav
- Create: `public/scripts/tour-calendar.js`
- Create: `src/styles/tour-calendar.css` (via responsive-css skill)

- [ ] **Step 1: Month grid** + unscheduled rail (no DnD yet)
- [ ] **Step 2: Links** into tour day pages
- [ ] **Step 3: Commit** `feat: Locale tour calendar shell`

---

### Task 3: Drag + click assign

**Files:**
- Modify: `public/scripts/tour-calendar.js`

- [ ] **Step 1: DnD** unscheduled → day → assign API → reload or DOM update
- [ ] **Step 2: Click fallback** select listing + day + Assign button
- [ ] **Step 3: Drag to rail** → unassign
- [ ] **Step 4: Smoke; commit** `feat: calendar drag-and-drop tour assign`
