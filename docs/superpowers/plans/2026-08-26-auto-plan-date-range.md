# Auto-plan date-range fill Implementation Plan

> **For agentic workers:** Execute task-by-task. Checkboxes track progress.

**Goal:** Replace undated Auto-plan clusters with fill-into-date-range: spread-first assignment of unscheduled listings onto days in a window, merging when proximate; preview then apply.

**Architecture:** Pure `planFillDateRange()` + tests; `POST /api/tours/auto-plan` returns preview for `startDate`/`endDate`; `POST /api/tours/auto-plan-apply` re-runs plan and writes merges + autoroutes touched days. Calendar rail UI: range inputs + Preview/Apply.

**Tech Stack:** Astro, Supabase, Vitest, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-08-26-auto-plan-date-range-design.md`

## Global Constraints

- Spread (lower stop count) wins; proximity only among eligible days.
- Eligible day: under max-6 AND (empty OR listing within 3 mi of a stop on that day).
- Already scheduled listings ignored; outside-range days untouched.
- New stops date-only; autoroute after apply.
- Branch: continue `feature/plan-tour-appointment-times` (or current feature branch). No commit unless asked.

---

### Task 1: Date range keys + fill planner (TDD)

**Files:**
- Modify: `src/lib/tours/week.ts` — `dateKeysInclusive(startKey, endKey): string[]`
- Create: `src/lib/tours/fill-date-range.ts`
- Create: `tests/fill-date-range.test.ts`

**Produces:**

```ts
planFillDateRange({
  rangeDates: string[],
  existingByDate: Record<string, { listingId: string; lat: number; lng: number }[]>,
  unscheduled: { id: string; lat: number; lng: number }[],
  radiusM?: number,
  maxPerDay?: number,
}): {
  assignments: { tourDate: string; listingIds: string[]; merge: boolean }[];
  overflowIds: string[];
}
```

Rules: assign unscheduled sorted by id; eligible = count < max && (no points || within radius); pick min count, then proximate preferred, then earlier date; update in-memory counts/points.

- [ ] Tests then implement

### Task 2: API preview + apply

**Files:**
- Modify: `src/pages/api/tours/auto-plan.ts` — require `startDate`, `endDate`; return assignments + overflow + labels
- Create: `src/pages/api/tours/auto-plan-apply.ts` — same inputs; re-plan; upsert days; insert stops (merge, append sort_order); `optimizeTourDay` each touched day
- Deprecate empty-day-only save path usage from calendar (keep `auto-plan-save` for tours-plan.js if still used, or leave)

### Task 3: Calendar rail UI

**Files:**
- Modify: `tours/index.astro` — start/end date inputs (default current week), Preview + Apply
- Modify: `tours-calendar.js` — wire preview/apply; show assignment cards (not draggable clusters)
- Modify: `chrome.css` — compact range row

### Task 4: Spec status Approved

---

## Spec coverage

| Spec | Task |
|------|------|
| Date range | 2–3 |
| Spread + proximate merge | 1 |
| Preview then apply | 2–3 |
| Overflow visible | 2–3 |
| Replace undated primary | 3 |
| Autoroute after write | 2 |
| No invented times | 2 |
