# Wayhome UI Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship soft-glass app chrome with system light/dark and a code-catalog accent theme per user (Settings).

**Architecture:** CSS variables + `data-theme` on `<html>`; theme catalog in `src/lib/ui/themes.ts`; `profiles.ui_theme_id` persistence; shared Astro layout for `/app`.

**Tech Stack:** Astro layouts, global CSS, Supabase profiles column, Vitest for catalog resolve.

**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-ui-chrome-design.md`

## Global Constraints

- Work on `staging` in the main checkout — **no git worktrees**.
- Catalog-driven Settings only; no theme admin UI.
- System color scheme only (`prefers-color-scheme`).
- Fail Fast: unknown `ui_theme_id` → resolve to `sea`, do not invent theme data.
- Follow `responsive-css` skill for any CSS authored.
- Use `npm run db:push` / Supabase MCP for migrations — do not ask to paste SQL.

---

## File structure

```
src/lib/ui/themes.ts
src/styles/tokens.css
src/styles/chrome.css
src/layouts/AppLayout.astro
src/layouts/AuthLayout.astro   # optional; or reuse tokens only
supabase/migrations/20260822180000_profile_ui_theme.sql
src/pages/api/profile/theme.ts
tests/themes.test.ts
```

---

### Task 1: Theme catalog + resolve helper (TDD)

**Files:**
- Create: `src/lib/ui/themes.ts`
- Create: `tests/themes.test.ts`

**Interfaces:**
- Produces: `UI_THEME_CATALOG`, `DEFAULT_UI_THEME_ID`, `listUiThemes()`, `resolveUiThemeId(raw: string | null | undefined): string`

- [ ] **Step 1: Write failing tests** for resolve (null → sea; unknown → sea; `steel` → steel) and list (ids include sea/steel/sand)

- [ ] **Step 2: Implement catalog** with labels + token maps (accent hex/CSS values for light and dark if needed, or single accent + media in CSS)

- [ ] **Step 3: Run** `npm test -- tests/themes.test.ts` — pass

- [ ] **Step 4: Commit** `feat: UI theme catalog and resolve helper`

---

### Task 2: Migration + types

**Files:**
- Create: `supabase/migrations/20260822180000_profile_ui_theme.sql`
- Modify: `src/lib/types/database.ts` (`Profile.ui_theme_id`)

- [ ] **Step 1: Migration** `alter table profiles add column if not exists ui_theme_id text;`

- [ ] **Step 2:** `npm run db:push` (or MCP apply) and `npm run db:status`

- [ ] **Step 3: Update types; commit** `feat(db): profiles.ui_theme_id`

---

### Task 3: Global tokens + glass CSS

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/chrome.css`
- Modify: map/list pages later via layout import

- [ ] **Step 1: Define** light/dark surfaces, glass, text, border, and `[data-theme='sea'|'steel'|'sand']` accent variables

- [ ] **Step 2: Chrome rules** for header, main, cards, buttons, inputs, tables (Compare-friendly), links, focus

- [ ] **Step 3: Commit** `feat: glass chrome tokens and base styles`

---

### Task 4: App layout + middleware theme load

**Files:**
- Create: `src/layouts/AppLayout.astro`
- Modify: `src/middleware.ts` (optional: attach theme to locals)
- Modify: representative `/app` pages to use layout (Nest home, Locale hub, Compare, Settings, listings, tours, unscheduled)

**Interfaces:**
- Layout props: `title`, `crumbs?`
- Locals or layout query: resolved `uiThemeId`

- [ ] **Step 1: AppLayout** sets `data-theme`, imports CSS, glass header + slot

- [ ] **Step 2: Convert app pages** to use layout (minimal markup change)

- [ ] **Step 3: Auth pages** import tokens/chrome lightly

- [ ] **Step 4: Commit** `feat: AppLayout with per-user data-theme`

---

### Task 5: Settings theme picker + API

**Files:**
- Modify: `src/pages/app/settings.astro`
- Create: `src/pages/api/profile/theme.ts`

- [ ] **Step 1: API** POST `{ ui_theme_id }` → validate via `resolveUiThemeId` / catalog membership → update `profiles` for `auth.uid()`

- [ ] **Step 2: Settings UI** — radio/select from `listUiThemes()`; show current; save

- [ ] **Step 3: Manual smoke** — switch accents; reload persists; OS dark/light still works

- [ ] **Step 4: Commit** `feat: Settings accent theme picker`

---

### Task 6: Smoke checklist

- [ ] Nest, Locale, Compare, listing, tour pages render under glass shell
- [ ] Theme switch persists across reload
- [ ] Invalid DB value falls back to sea visually
- [ ] No theme admin UI shipped
