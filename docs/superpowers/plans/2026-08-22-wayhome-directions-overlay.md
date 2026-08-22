# Wayhome Directions Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app glass modal with Maps JS directions from listing to proximity winner.

**Architecture:** Shared overlay DOM + `directions-overlay.js`; Compare and listing explore open it with origin/destination/mode; external Maps URL remains secondary.

**Tech Stack:** Maps JavaScript API Directions, existing chrome CSS, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-directions-overlay-design.md`

## Global Constraints

- No worktrees; branch/work on `staging`.
- Fail Fast: missing coords → no modal.
- Reuse `googleMapsDirectionsUrl` for external link.
- Match glass modal styles from UI chrome.

---

### Task 1: Overlay shell + script

**Files:**
- Create: `public/scripts/directions-overlay.js`
- Create: `src/components/DirectionsOverlay.astro` (markup once) or inject from script
- Modify: `src/styles/chrome.css` (modal)

- [ ] **Step 1: Markup** dialog with map div, meta line, Close, external link
- [ ] **Step 2: JS API** `openDirectionsOverlay({ origin, destination, travelMode, title, durationLabel, externalUrl, mapKey, mapId })`
- [ ] **Step 3: DirectionsService.route + DirectionsRenderer; fit bounds
- [ ] **Step 4: Commit** `feat: directions overlay shell`

---

### Task 2: Wire Compare

**Files:**
- Modify: `public/scripts/proximity-compare.js`
- Modify: `src/pages/app/locales/[localeId]/compare.astro`

- [ ] **Step 1: Replace primary “Directions”** with button that opens overlay; keep external as secondary link
- [ ] **Step 2: Smoke** Beach cell → overlay route
- [ ] **Step 3: Commit** `feat: Compare opens directions overlay`

---

### Task 3: Wire listing proximity

**Files:**
- Modify: `public/scripts/listing-proximity.js`
- Modify: listing detail page

- [ ] **Step 1: After ok result**, “Show route” opens same overlay
- [ ] **Step 2: Commit** `feat: listing proximity directions overlay`
