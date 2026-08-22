# Wayhome Attribute Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist listing attribute fields and ship a Locale Attributes compare matrix.

**Architecture:** Migration adds nullable columns on `listings`; ListingForm gains inputs; new Locale page renders matrix; format helpers never coerce null to zero.

**Tech Stack:** Astro, Supabase, chrome styles, Vitest format helpers.

**Spec:** `docs/superpowers/specs/2026-08-22-wayhome-attribute-compare-design.md`

## Global Constraints

- No worktrees; `staging` only.
- Fail Fast: null ≠ 0 for money/size.
- Plan scope only — no proximity changes except Locale nav link.
- `npm run db:push` for migration.

---

### Task 1: Schema + types

**Files:**
- Create: `supabase/migrations/20260822190000_listing_attributes.sql`
- Modify: `src/lib/types/database.ts`

- [ ] **Step 1: Add columns** per spec
- [ ] **Step 2: db:push; update types; commit** `feat(db): listing attribute columns`

---

### Task 2: Format helpers (TDD)

**Files:**
- Create: `src/lib/listings/format-attributes.ts`
- Create: `tests/format-attributes.test.ts`

- [ ] **Step 1: Tests** null → "—"; `1200` → "$1,200"; sqft formatting
- [ ] **Step 2: Implement; commit** `feat: attribute display formatters`

---

### Task 3: Listing form + API

**Files:**
- Modify: `src/components/ListingForm.astro`
- Modify: `src/pages/api/listings/create.ts`, `update.ts`

- [ ] **Step 1: Optional inputs**; parse empty → null
- [ ] **Step 2: Commit** `feat: edit listing attributes`

---

### Task 4: Attributes compare page

**Files:**
- Create: `src/pages/app/locales/[localeId]/attributes.astro`
- Modify: Locale hub nav

- [ ] **Step 1: Matrix** listings × attributes using formatters
- [ ] **Step 2: Smoke; commit** `feat: Locale attributes compare matrix`
