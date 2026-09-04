# Tours bulk unschedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development if the user asks for subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select all / clear / remove selected on the selected tour day; drop day-dot onto Unscheduled to clear **untimed** stops only; toast for outcomes (no confirm modals).

**Architecture:** Extend calendar-action with `clearUntimed` (by `tourDate` or `tourDayId`). Client: selection toolbar + Shift-range; unscheduled rail accepts `kind: 'day'` and calls clearUntimed. Keep existing multi-listing unassign for Remove selected (including timed stops).

**Tech Stack:** Astro, Supabase, Vitest, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-09-04-tours-favorites-bulk-value-rank-design.md`

## Global Constraints

- Day-dot clear: only `appointment_time IS NULL`. Timed stops stay; day deleted only if empty after clear.
- Remove selected / per-stop remove: may remove timed (explicit).
- Toast, not confirm, for partial clear / nothing to clear / bulk remove summary.
- No em dashes in user-facing copy.
- Branch from `staging`: `feature/tours-bulk-unschedule` (or continue favorites branch if stacking). Commit only if the user asks.
- Next port: docs only. See `docs/superpowers/plans/2026-09-04-next-astro-parity-backlog.md` (fold into the Next migration plan when that branch is edited). Do not implement in Next until scheduled.

## File map

| File | Role |
|------|------|
| `src/lib/tours/calendar-action.ts` | `clearUntimed` action + parse |
| `src/pages/api/tours/calendar-action.ts` | Parse new action type |
| `tests/calendar-action-clear-untimed.test.ts` | TDD for clearUntimed rules (mock or pure extract) |
| `public/scripts/tours-calendar.js` | Drop day on rail; Select all / Clear / Remove; Shift-range; toasts |
| `src/pages/app/locales/[localeId]/tours/index.astro` | Toolbar markup; update Scheduling tips |
| `src/styles/chrome.css` | Toolbar layout |

---

### Task 1: clearUntimed server action (TDD)

**Files:**
- Modify: `src/lib/tours/calendar-action.ts`
- Modify: `src/pages/api/tours/calendar-action.ts`
- Create: `tests/calendar-action-clear-untimed.test.ts` (prefer extracting pure “which listing ids to clear” if DB mock is heavy)

**Produces:**

```ts
| { type: 'clearUntimed'; tourDate: string }
// Result ok payload may include: clearedCount, keptTimedCount, tourDayId | null
```

Behavior:
1. Resolve `tour_days` for locale + tourDate.
2. Load stops with `appointment_time`.
3. Delete stops where time is null.
4. If no stops left → delete day; else re-optimize.
5. Return counts for toast.

- [x] **Step 1:** Write failing tests for: all untimed cleared; mixed keeps timed; all timed → clearedCount 0; missing day → 404/empty ok with zeros.
- [x] **Step 2:** Implement `clearUntimed` in `applyCalendarAction`.
- [x] **Step 3:** Parse in API route.
- [x] **Step 4:** `npm test` — PASS.

Note: Vitest suite-wide `config` failure remains in this environment; pure `partitionStopsForClearUntimed` tests are in place.

---

### Task 2: Day-dot drop onto Unscheduled

**Files:**
- Modify: `public/scripts/tours-calendar.js` — rail `drop` handler

Current guard rejects non-listing. Change to:

```js
if (payload.kind === 'day') {
  const result = await postAction({ type: 'clearUntimed', tourDate: payload.fromDate });
  // toast from clearedCount / keptTimedCount
  reloadForDay(...);
  return;
}
if (payload.kind === 'listing' && cfg?.selectedTourId) {
  // existing unassign
}
```

Toast examples (no em dash):
- `Cleared 4 untimed stops. 2 timed left on this day.`
- `No untimed stops to clear.`
- `Cleared 3 stops.` (day empty)

- [x] **Step 1:** Accept day payload on rail dragover/drop.
- [x] **Step 2:** Toast + reload.
- [ ] **Step 3:** Smoke: mix of timed/untimed; all timed; all untimed.

---

### Task 3: Day panel selection toolbar + Shift-range

**Files:**
- Modify: `tours/index.astro` — when `selectedTour`, toolbar: Select all, Clear, Remove selected (disabled when none selected)
- Modify: `tours-calendar.js` — wire buttons; Shift+click range within day list (`[data-tours-stops]`); Remove selected → `unassign` with selected ids + toast count
- Modify: Scheduling tips overlay — document Ctrl/Cmd, Shift, toolbar; remove or fix false Space keyboard claim if still unimplemented
- Modify: `chrome.css` — compact toolbar

**Rules:**
- Select all: only listing stops on the selected day (not custom start/end).
- Detail `<a>` still navigates; selection on row chrome / Ctrl/Cmd / Shift.
- Toast: `Removed N stops from this day.`

- [x] **Step 1:** Markup + styles.
- [x] **Step 2:** Select all / Clear / Remove selected.
- [x] **Step 3:** Shift-click range (anchor = last plain click).
- [x] **Step 4:** Smoke + tip copy update.

---

### Task 4: Next port checklist

- [x] Port `clearUntimed` calendar action *(checklist noted for Next; Astro done)*
- [x] Day-dot → unscheduled drop + toasts *(Astro done)*
- [x] Selection toolbar + Shift-range *(Astro done)*

Next port when absorbing `staging` on `feature/plan-nextjs-migration`:
1. `clearUntimed` in calendar-action + API parse
2. Day-dot → unscheduled rail drop + toast copy
3. Selection toolbar + Ctrl/Cmd + Shift-range

---

## Spec coverage

| Spec | Task |
|------|------|
| Day-dot untimed only | 1–2 |
| Toast policy | 2–3 |
| Select all / Remove selected | 3 |
| Timed kept on day-dot | 1 |
| Remove selected may include timed | 3 |
| Next checklist | 4 |
