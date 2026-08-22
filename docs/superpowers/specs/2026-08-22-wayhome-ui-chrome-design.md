# Wayhome — UI Chrome Design

**Date:** 2026-08-22  
**Status:** Approved (brainstorm)  
**Depends on:** Nest / Locale app shell  
**Plan:** `docs/superpowers/plans/2026-08-22-wayhome-ui-chrome.md`

## Problem

The app is functional but visually bare (unstyled HTML). Maps, Compare, and tours need a coherent shell so later features (directions overlay, attribute compare, calendar) share one look.

## Goals

- Soft **glass** shell: frosted header + content panels, quiet page background.
- **System** light/dark via `prefers-color-scheme` (no manual theme toggle in v1).
- **Accent themes** from a **code catalog** (`id` + `label` + tokens). Settings lists the catalog; not hard-coded option labels in the page.
- Each signed-in user stores their own `ui_theme_id` on **profiles**.
- Shared layout for `/app/**` (and token-aligned auth pages).

## Non-goals

- **Theme admin UI** (Nest owners adding/editing themes in the DB). Deferred because catalog is code-owned (brainstorm choice A). A future “theme packs in Postgres” spec can unlock admin CRUD without rewriting Settings if Settings already reads a catalog API/helper.
- Nest-level shared branding.
- Manual light/dark override (follow OS only in v1).
- Redesigning map tile styling beyond opaque wells.
- Implementing directions overlay / attribute compare / calendar in this chrome plan.

## Why no theme admin UI (v1)

Themes are developer-maintained packages (`sea`, `steel`, `sand`, …). An admin UI implies DB-stored theme definitions, validation, and RLS — a separate product surface. Settings stays **catalog-driven** so admin can land later without a Settings redesign.

## Visual direction

- Soft glass panels: translucent surface, light border, `backdrop-filter` blur, soft shadow.
- Page: subtle gradient/mesh (not photographic hero).
- Maps: opaque rounded wells (no glass over tiles).
- Typography: distinctive but readable; avoid Inter/Roboto/Arial/system-only stacks for brand moments; body can be a clean readable face.
- Accent only from active theme tokens (links, primary buttons, focus rings, Compare highlights).
- Avoid purple-gradient SaaS cliché, cream+terracotta brochure look, and broadsheet density.

### v1 catalog

| id | label |
|----|--------|
| `sea` | Sea glass |
| `steel` | Cool steel |
| `sand` | Warm sand |

Default when missing/invalid: `sea`.

## Data

- Migration: `profiles.ui_theme_id text` (nullable).
- Resolve: if null or not in catalog → treat as `sea` (document as default; do not invent unknown theme ids).
- RLS: existing profiles update-own policies cover the column.

## Apply mechanism

1. Load profile theme for signed-in user (middleware or layout).
2. Set `data-theme="{id}"` on `<html>`.
3. Global CSS maps `[data-theme='…']` to accent CSS variables; light/dark via `@media (prefers-color-scheme)`.
4. Settings: form posts selected catalog id → update profile → redirect.

## Shell

- `AppLayout` (or equivalent): glass header with Nest/Locale crumbs + Settings; glass `<main>`; footer optional/minimal.
- Wire existing `/app/**` pages through the layout.
- Login/signup: same CSS tokens, lighter chrome (no Nest nav).

## Testing

- Unit: catalog resolve (`resolveThemeId(raw) → known id`).
- Manual: Settings switch accent; OS dark/light flip; Nest + Locale + Compare still usable.
