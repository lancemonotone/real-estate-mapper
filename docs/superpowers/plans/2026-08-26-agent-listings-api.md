# Agent listings API Implementation Plan

> **For agentic workers:** Implement task-by-task.

**Goal:** Session-auth JSON agent API: list locale listings, upsert by source_url, patch by id.

**Architecture:** Shared `src/lib/listings/agent-write.ts` for parse/geocode/write; routes under `src/pages/api/agent/`. Partial unique index on `(locale_id, source_url)`.

**Tech Stack:** Astro API routes, Supabase, Vitest.

---

## Task 1: Migration

- [x] Partial unique index on listings (locale_id, source_url) where source_url is not null
- [x] `npm run db:push`

## Task 2: Shared write helpers + tests

- [x] Parse agent listing JSON body (Fail Fast nulls)
- [x] Upsert-by-source_url + update-by-id helpers
- [x] Unit tests for body parsing

## Task 3: Routes

- [x] `GET /api/agent/locales/[localeId]/listings`
- [x] `PUT /api/agent/locales/[localeId]/listings`
- [x] `PATCH /api/agent/listings/[id]`

## Task 4: Agent docs note

- [x] Brief note in `docs/agents/` or link from design
