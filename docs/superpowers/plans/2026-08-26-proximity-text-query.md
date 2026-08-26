# Nearest search phrase (text_query) Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Compare / Travel Times criterion kind that finds each listing’s nearest place matching a free-form search phrase (Google Text Search), when the category is not a Table A type.

**Architecture:** New `proximity_criteria.kind = 'text_query'` with `text_query` column. POI cache reuses `locale_pois.place_type_key` with stable key `text:<normalized>`. Fill via existing `searchTextPlaces` + locale tiling. Score via existing shortlist → route matrix path.

**Tech Stack:** Astro API routes, Supabase migration, Places Text Search (New), Vitest.

## Global Constraints

- Fail Fast: no invented place types; empty Text Search → `no_place`.
- Shared place stays Autocomplete/Text pick-one; this kind is phrase → nearest per listing.
- UI copy: “Nearest search phrase” (not “text_query” / “one-off”).

---

## Task 1: Migration + types + cache key helper

- [x] Migration: add `text_query text`, extend kind check, update type_fields constraint
- [x] `ProximityCriterionKind` += `text_query`; criterion row includes `text_query`
- [x] `textQueryCacheKey` / `normalizeTextQuery` + unit tests
- [x] `npm run db:push`

## Task 2: Fill + evaluate

- [x] `fillLocalePoisForTextQuery(supabase, locale, textQuery)`
- [x] `evaluateCriterionProximity` / `evaluateOneOffProximity` handle `text_query`
- [x] Refactor nearest evaluation to share place_type / text_query path via cache key

## Task 3: APIs

- [x] `POST /api/proximity/criteria` accepts `text_query`
- [x] `POST /api/proximity/compute-one-off` accepts `text_query`
- [x] `refresh-pois` also refreshes text_query criteria

## Task 4: UI

- [x] Compare Add column: kind option + phrase field
- [x] Listing / Compare cell picker: Nearest search phrase mode
- [x] Column header shows phrase label
