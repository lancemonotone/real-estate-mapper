# Wayhome Next.js migration — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Astro app with a Next.js App Router workspace that feels fast and consistent, using StyleX for a bottom-up design system.

**Architecture:** Next.js on Vercel; Supabase SSR auth; Route Handlers port `src/pages/api`; `src/lib` carries forward; React features replace `public/scripts`; StyleX via official Next.js Babel + PostCSS setup; nested layouts for persistent app/locale chrome.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase SSR, StyleX, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-02-wayhome-nextjs-migration-design.md`  
**Platform / agency / pricing / onboarding:** `docs/superpowers/specs/2026-09-02-wayhome-platform-agency-model.md`  
**Database:** New Supabase project for Next (`docs/agents/supabase-next-db.md`). Do not migrate agency schema on Astro prod.

## Global Constraints

- Branch from `staging`; work on `feature/plan-nextjs-migration` (or current migration branch).
- **Do not merge to `staging` until the client explicitly approves.**
- No production traffic: **delete Astro paths when replaced**, not maintain parallel UI stacks.
- Fail Fast: no invented theme data, coordinates, or entitlement defaults.
- No em dashes in user-facing copy.
- Extend StyleX primitives; do not clone button/panel/badge chrome in feature modules.
- Small commits per task (one plan task ≈ one commit).
- `npm run db:push` / Supabase MCP for migrations; do not paste SQL into dashboard.

---

## Route inventory (Astro → Next)

Check **Next** when the App Router page ships. Check **Del** when the Astro file is removed.

| Del | Next route | Astro source |
|-----|------------|--------------|
| [ ] | `app/page.tsx` | `src/pages/index.astro` |
| [ ] | `app/login/page.tsx` | `src/pages/login.astro` |
| [ ] | `app/signup/page.tsx` | `src/pages/signup.astro` |
| [ ] | `app/invite/[token]/page.tsx` | `src/pages/invite/[token].astro` |
| [ ] | `app/(workspace)/app/page.tsx` | `src/pages/app/index.astro` |
| [ ] | `app/(workspace)/app/settings/page.tsx` | `src/pages/app/settings.astro` |
| [ ] | `app/(workspace)/app/upgrade/page.tsx` | `src/pages/app/upgrade.astro` |
| [ ] | `app/(workspace)/app/tours/page.tsx` | `src/pages/app/tours/index.astro` |
| [ ] | `app/(workspace)/app/listings/page.tsx` | `src/pages/app/listings/index.astro` |
| [ ] | `app/(workspace)/app/unscheduled/page.tsx` | `src/pages/app/unscheduled.astro` |
| [ ] | `app/(workspace)/app/locales/new/page.tsx` | `src/pages/app/locales/new.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/page.tsx` | `src/pages/app/locales/[localeId]/index.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/edit/page.tsx` | `src/pages/app/locales/[localeId]/edit.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/compare/page.tsx` | `src/pages/app/locales/[localeId]/compare.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/travel-times/page.tsx` | `src/pages/app/locales/[localeId]/travel-times.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/unscheduled/page.tsx` | `src/pages/app/locales/[localeId]/unscheduled.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/listings/page.tsx` | `src/pages/app/locales/[localeId]/listings/index.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/listings/new/page.tsx` | `src/pages/app/locales/[localeId]/listings/new.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/listings/[id]/page.tsx` | `src/pages/app/locales/[localeId]/listings/[id].astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/tours/page.tsx` | `src/pages/app/locales/[localeId]/tours/index.astro` |
| [ ] | `app/(workspace)/app/locales/[localeId]/tours/[id]/page.tsx` | `src/pages/app/locales/[localeId]/tours/[id].astro` |

---

## API inventory (Astro → Route Handlers)

Port **logic** from `src/pages/api/**/*.ts` into `app/api/**/route.ts`. Check **API** when handler ships; check **Del** when Astro API file removed.

| API | Del | Astro source |
|-----|-----|--------------|
| [ ] | [ ] | `src/pages/api/auth/logout.ts` |
| [ ] | [ ] | `src/pages/api/profile/theme.ts` |
| [ ] | [ ] | `src/pages/api/profile/borders.ts` |
| [ ] | [ ] | `src/pages/api/profile/dev-hunt-pass-preview.ts` |
| [ ] | [ ] | `src/pages/api/locales/create.ts` |
| [ ] | [ ] | `src/pages/api/locales/update.ts` |
| [ ] | [ ] | `src/pages/api/locales/delete.ts` |
| [ ] | [ ] | `src/pages/api/locales/preview-place.ts` |
| [ ] | [ ] | `src/pages/api/listings/create.ts` |
| [ ] | [ ] | `src/pages/api/listings/update.ts` |
| [ ] | [ ] | `src/pages/api/listings/favorite.ts` |
| [ ] | [ ] | `src/pages/api/listings/passed.ts` |
| [ ] | [ ] | `src/pages/api/listings/geocode.ts` |
| [ ] | [ ] | `src/pages/api/listings/import-url.ts` |
| [ ] | [ ] | `src/pages/api/listings/[id]/surface.ts` |
| [ ] | [ ] | `src/pages/api/places/autocomplete.ts` |
| [ ] | [ ] | `src/pages/api/places/details.ts` |
| [ ] | [ ] | `src/pages/api/places/photo.ts` |
| [ ] | [ ] | `src/pages/api/proximity/*.ts` (8 routes) |
| [ ] | [ ] | `src/pages/api/tours/*.ts` (14 routes) |
| [ ] | [ ] | `src/pages/api/agent/**/*.ts` (3 routes) |

---

## Client script retirement (public/scripts → React)

Do not port scripts wholesale. Replace behavior in `src/features/*`. Check when feature module owns the behavior.

| Retired script | Feature module |
|----------------|----------------|
| `locale-nav.js` | `src/features/locale/LocaleNav.tsx` |
| `listing-detail.js`, `listing-detail-sync` | `src/features/listing/ListingDetail.tsx` + hooks |
| `listing-form-autosave`, `listing-gallery*` | `src/features/listing/ListingForm.tsx` |
| `listing-proximity.js`, `proximity-compare.js` | `src/features/proximity/*` |
| `listing-favorite.js` | `src/features/listing/ListingReactions.tsx` (favorite + passed) |
| `favorites-filter.js` | Shared favorites filter hook / control |
| `tours-calendar.js`, `tours-plan.js`, `tours-day.js` | `src/features/tours/*` |
| `compare` matrix scripts | `src/features/compare/*` |
| `map-*.js`, `locale-map.js`, `listing-map.js`, `tour-map.js` | `src/features/maps/*` |
| `directions-overlay.js` | `src/features/directions/*` |
| `ui-icons.js` | `src/components/IconButton.tsx` / shared Lucide glyph map |
| Others | Grep `public/scripts` at Phase 5; zero references before delete folder |

---

## StyleX module checklist (from `chrome.css`)

Build bottom-up. Check **Inv** when StyleX module exists. Check **Wire** when used in React. Check **Del** when removed from `chrome.css` (delete file at end).

| Inv | Wire | Del | Target module | Source |
|-----|------|-----|---------------|--------|
| [ ] | [ ] | [ ] | `tokens.stylex.ts`, `themes.stylex.ts` | `tokens.css`, `data-theme` |
| [ ] | [ ] | [ ] | `bordersOff.stylex.ts` | `ui-borders-off.css` |
| [ ] | [ ] | [ ] | `primitives/*` | `chrome.css` L1–580 (buttons, badges, panel, form) |
| [ ] | [ ] | [ ] | `shell/*` | app header, marketing, app shell |
| [ ] | [ ] | [ ] | `features/listingCard.stylex.ts` | shared listing row/card |
| [ ] | [ ] | [ ] | `features/locale/*` | locale hero, nav, browse |
| [ ] | [ ] | [ ] | `features/listing/*` | listing detail, form, facts |
| [ ] | [ ] | [ ] | `features/compare/*` | matrix, compare header |
| [ ] | [ ] | [ ] | `features/tours/*` | stops, workspace, week |
| [ ] | [ ] | [ ] | `features/proximity/*` | panel, picker, cells |
| [ ] | [ ] | [ ] | `features/maps/*` | map wells, pin info |
| [ ] | [ ] | [ ] | `features/nest/*`, `settings/*`, `monetization/*` | settings, invite, upgrade |
| [ ] | [ ] | [ ] | `features/gallery/*`, `directions/*` | photo gallery, overlay |

---

## File structure (initial scaffold)

```
package.json                    # next, react, stylex; remove astro deps at cutover
next.config.ts
babel.config.js                 # StyleX per official Next.js doc
postcss.config.js
middleware.ts
app/globals.css                 # @stylex
app/layout.tsx
tsconfig.json                   # Next paths @/*
src/lib/                        # unchanged during early phases
```

---

### Task 0: Branch + Next.js scaffold

**Files:**
- Create: `next.config.ts`, `app/layout.tsx`, `app/page.tsx` (placeholder), `middleware.ts` (stub)
- Modify: `package.json`, `tsconfig.json`
- Remove from active use later: `astro.config.mjs` (keep until final cutover task)

- [ ] **Step 1:** Create branch `feature/plan-nextjs-migration` from `staging` if not already on it
- [ ] **Step 2:** `npx create-next-app@latest` pattern **manually** into repo (App Router, TS, no Tailwind, `app/`, `src/`) or add deps without duplicating `src/lib`
- [ ] **Step 3:** Verify `npm run dev` serves placeholder `/` on Next while Astro is still present (temporary dual `package.json` scripts: `dev:next` until cutover)
- [ ] **Step 4:** Add Vercel Next adapter config; confirm `npm run build` produces Next output
- [ ] **Step 5:** Commit `chore: Next.js scaffold`

---

### Task 1: Supabase auth middleware

**Files:**
- Create: `middleware.ts`, `src/server/supabase/middleware.ts`, `src/server/supabase/server.ts`
- Port from: `src/middleware.ts`, `src/lib/supabase/server.ts`

**Interfaces:**
- Produces: `updateSession(request)` for middleware; `createClient()` for Server Components and Route Handlers

- [ ] **Step 1:** Port Astro middleware auth rules (`/app` gate, profile theme/borders on session)
- [ ] **Step 2:** Wire `middleware.ts` matcher for `/app/:path*`
- [ ] **Step 3:** Smoke: unauthenticated `/app` redirects to `/login`
- [ ] **Step 4:** Commit `feat(next): Supabase auth middleware`

---

### Task 2: Port API Route Handlers (batch by domain)

Execute sub-batches; each ends with `npm test` + commit.

1. [ ] **Auth + profile** (`logout`, `theme`, `borders`, `dev-hunt-pass-preview`)
2. [ ] **Locales** (`create`, `update`, `delete`, `preview-place`)
3. [ ] **Listings** (`create`, `update`, `favorite`, `geocode`, `import-url`, `surface`)
4. [ ] **Places** (`autocomplete`, `details`, `photo`)
5. [ ] **Proximity** (all `proximity/*` routes)
6. [ ] **Tours** (all `tours/*` routes)
7. [ ] **Agent** (`agent/listings`, `agent/locales`)

Each sub-batch:
- Copy handler logic into `app/api/.../route.ts`
- Keep request/response JSON shape identical for minimal client churn during migration
- Delete matching `src/pages/api` files only after Next handlers verified
- Commit `feat(next): port <domain> API routes`

---

### Task 3: StyleX foundation

**Files:**
- Create: `babel.config.js`, `postcss.config.js`, `app/globals.css`, `src/styles/stylex/tokens.stylex.ts`, `src/styles/stylex/themes.stylex.ts`, `src/styles/stylex/primitives/button.stylex.ts`
- Reference: https://stylexjs.com/docs/learn/installation/nextjs

- [ ] **Step 1:** Install `@stylexjs/stylex`, `@stylexjs/babel-plugin`, `@stylexjs/postcss-plugin`, `autoprefixer`
- [ ] **Step 2:** Add `babel.config.js` and `postcss.config.js` per official Next.js doc
- [ ] **Step 3:** `app/globals.css` with `@stylex;` and font import; import in root `app/layout.tsx`
- [ ] **Step 4:** Port tokens from `src/styles/tokens.css` to `defineVars`; wire `data-theme` on `<html>`
- [ ] **Step 5:** Port button primitive from `chrome.css` L409–524; proof button in a throwaway `app/dev/stylex/page.tsx`
- [ ] **Step 6:** `npm run build` passes with StyleX CSS in output
- [ ] **Step 7:** Commit `feat(stylex): Next.js tokens and button primitive`

---

### Task 4: StyleX primitives + shell

**Checklist:** primitives + shell rows in StyleX table.

- [ ] Port remaining primitives (badge, iconButton, panel, glass, form, layout, alert)
- [ ] Port shell styles (app header, marketing hero, app shell layout)
- [ ] Create `AppShell.tsx`, `AppHeader.tsx`, `LocaleNav.tsx` (structure only, minimal data)
- [ ] **`/dev/ui` theme smoke:** `ThemeProvider` wraps the catalog; **one** button row (no stacked theme blocks). Theme registry reads `listUiThemes()` today; super-admin DB catalog later. Add a theme **toggle** (segmented control or similar) that calls `setThemeId` and re-styles primitives via StyleX `createTheme` vars. Site-wide font stack (site-admin setting, fallback to default) is a separate platform-admin task.
- [ ] Delete matching rules from `chrome.css` as each primitive/shell module lands
- [ ] Commit `feat(stylex): primitives and app shell`

---

### Task 5: Workspace layouts + auth pages

**Files:**
- Create: `app/(workspace)/app/layout.tsx`, `login/page.tsx`, `signup/page.tsx`, `app/(workspace)/app/page.tsx`

- [ ] **Step 1:** `app/(workspace)/app/layout.tsx` wraps `AppShell`; children slot for pages
- [ ] **Step 2:** Port login/signup pages (server components + forms posting to Supabase)
- [ ] **Step 3:** Port Nest home (`/app`) locale list
- [ ] **Step 4:** Delete Astro `login.astro`, `signup.astro`, `app/index.astro` when Next pages work
- [ ] **Step 5:** Commit `feat(next): auth pages and app shell layout`

---

### Task 6: Locale layout + hub

**Files:**
- Create: `app/(workspace)/app/locales/[localeId]/layout.tsx`, `page.tsx`, `edit/page.tsx`, `new/page.tsx`
- Feature: `src/features/locale/*`

- [ ] **Step 1:** Locale layout mounts `LocaleNav` + entitlement banner (persists across child routes)
- [ ] **Step 2:** Port locale hub and edit/new forms
- [ ] **Step 3:** Retire `locale-nav.js`, `locale-form.js`
- [ ] **Step 4:** Delete matching Astro locale pages
- [ ] **Step 5:** Commit `feat(next): locale hub and layout`

---

### Task 7: Listing feature

**Files:**
- `src/features/listing/*`, listings routes under `locales/[localeId]/listings/`

- [ ] **Step 1:** Port listings index + new listing
- [ ] **Step 2:** Port listing detail (hero, facts, costs, gallery, map) as client/server split
- [ ] **Step 3:** Replace autosave with React hook (no DOM gallery patch)
- [ ] **Step 4:** Replace `listing-detail-sync` with refetch/state after mutations
- [ ] **Step 5:** Retire listing scripts + `src/client/listing-*`
- [ ] **Step 6:** Commit `feat(next): listing feature`

---

### Task 8: Maps feature

- [ ] Port locale map, listing map, tour map as client components
- [ ] Retire `map-*.js`, `locale-map.js`, `listing-map.js`, `tour-map.js`
- [ ] Commit `feat(next): maps feature`

---

### Task 9: Proximity feature

- [ ] Port proximity panel, place picker, compare cell clients
- [ ] Retire `listing-proximity.js`, `proximity-compare.js`, `place-search.js`, `place-type-picker.js`
- [ ] Commit `feat(next): proximity feature`

---

### Task 10: Compare feature

- [ ] Port compare page + matrix (sticky columns, favorite filter, sort)
- [ ] Retire matrix scripts
- [ ] Commit `feat(next): compare feature`

---

### Task 11: Tours feature

- [ ] Port tours index, tour day, calendar workspace, unscheduled rails
- [ ] Retire `tours-*.js`, `tour-week-jump-popover.js`
- [ ] Commit `feat(next): tours feature`

---

### Task 12: Settings, upgrade, marketing, invite

- [ ] Port settings (theme, borders, invite), upgrade, marketing home, invite token page
- [ ] Commit `feat(next): settings, upgrade, marketing`

---

### Task 14: Platform routes, agency schema, onboarding (after core nest product)

**Spec:** `docs/superpowers/specs/2026-09-02-wayhome-platform-agency-model.md`  
**DB:** new Supabase project only (`docs/agents/supabase-next-db.md`)

- [ ] Route rename `/app` → `/nest`; add `/admin`, `/agency` shells
- [ ] Remove auto `ensureNestForUser` on sign-in; chooser + `/invite/{token}`
- [ ] Agency tables + seat lifecycle; entitlement policy layer (shared nest code)
- [ ] Nest picker + remembered default nest
- [ ] Stripe: Nest Pro $29/90d, Agency $249 + seat bundle
- [ ] Commit in slices (`feat(platform): …`)

---

### Task 13: Astro removal + cutover

- [ ] Delete `src/pages/**`, `src/layouts/**`, `src/components/*.astro`, `public/scripts/`, `astro.config.mjs`, Astro deps from `package.json`
- [ ] Delete remaining `src/styles/chrome.css`, `tokens.css`, `ui-borders-off.css`, map CSS files when StyleX checklist **Del** complete
- [ ] Single `npm run dev` / `npm run build` on Next only
- [ ] Full smoke checklist from spec
- [ ] `npm test` green
- [ ] Commit `chore: remove Astro stack`

---

## Astro Sept 2026 parity (port from staging)

> Shipped on Astro after this migration plan was drafted. Implement on the Next branch when absorbing `staging`. **Do not** leave these as Astro-only forever.

**Next DB:** Apply matching migrations on the Next Supabase project (`docs/agents/supabase-next-db.md`) when porting, not before. Migration: `supabase/migrations/20260904210600_listing_is_passed.sql` (and any Plan 03 locale default endpoint migrations already on Astro).

### Navigation and chrome

- [ ] Locale nav order: Listings, Tours, Compare, Travel Times
- [ ] Shared page header: title | actions (favorites heart filter last) | subheading below
- [ ] Sitewide favorites filter (`localStorage` key `wayhome:favorites-filter`)

### Compare

- [ ] Value column (`$X.XX/sqft` = Total/mo ÷ sq ft), first after Listing; lower is better
- [ ] SSR sort by Value; Sqft column immediately after Total/mo

### Tours defaults and filters

- [ ] Locale default start/end places; “Also set as default for days without a start or end” on save
- [ ] Clear (X) on start/end must persist; do not re-apply locale defaults on every Tours page load
- [ ] Favorites filter on Tours: hide non-hearted stops **unless** they have an appointment time
- [ ] Map markers follow the same appointment exception
- [ ] Remove set-as-start (S) from tour day listing rows (drag still works)
- [ ] Bulk unschedule (select all / clear untimed / remove selected)
- [ ] Auto-plan: “Skip passed” checkbox **checked by default**; “Favorites only” optional; surface `skippedPassed` in preview hint

### Listing reactions (favorite + passed)

- [ ] `listings.is_passed` boolean (default false); keep row so imports do not recreate it
- [ ] Mutual exclusivity with `is_favorite` in application code
- [ ] Route Handlers: favorite + passed return `{ favorite, passed }`
- [ ] UI: heart + thumbs-down (`ListingReactions`); detail header uses the same control contract as card reactions
- [ ] Client sync of `data-favorite` / `data-passed` and aria pressed state
- [ ] Auto-plan / fill-date-range honor `skipPassed` (default true)

### StyleX notes

- [ ] Port `.listing-reactions`, Value column, header filter layout via existing feature StyleX modules (extend primitives; do not clone button chrome)

---

## Self-review

| Spec requirement | Task |
|------------------|------|
| Next.js App Router on Vercel | Task 0 |
| Persistent locale layout | Task 6 |
| No public/scripts boot loops | Tasks 6–11 |
| StyleX bottom-up | Tasks 3–4 + checklist |
| Carry forward src/lib | Task 2 uses lib; no lib rewrite |
| Delete Astro when done | Task 13 |
| No merge without approval | Global Constraints |
| Organized phases | Tasks 0–13 order |

**Placeholder scan:** none.

---

## Execution handoff

Plan complete. Start with **Task 0** after client approves. One commit per task.
