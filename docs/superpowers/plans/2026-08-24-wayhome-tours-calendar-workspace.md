# Tours Calendar Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace locale Tours list+Plan as the primary UX with a week calendar workspace (unscheduled rail + week grid + map + selected-day stops), shared as the listing “add to tour” date picker.

**Architecture:** Server-rendered Tours page seeds JSON for days/stops/unscheduled/locale map. Client `tours-calendar.js` owns selection, drag/drop, Merge/Replace/Cancel overlay, and calls a JSON `POST /api/tours/calendar-action` that mutates stops/days then autoroutes via `optimizeTourDay`. Shared week helpers + a small Astro partial power both Tours and the listing tour overlay. `/tours/[id]` stays reachable (beta).

**Tech Stack:** Astro SSR, Supabase, vanilla JS (`public/scripts`), Google Maps scripts already in repo, Vitest.

## Global Constraints

- Fail Fast: no invented coords; visible optimize errors; Merge/Replace only via custom overlay (not `window.confirm`).
- Listing overlay: always merge; never show Merge/Replace/Cancel.
- Replace: target day’s listings return to unscheduled.
- No hard max stops on manual moves; Auto-plan cluster limits unchanged.
- CSS: mobile-first, nested `@media` at 768px/1024px, extend shared bases (responsive-css skill).
- No git worktrees; branch in place from current feature work.
- Keep `/tours/[id]` without hard redirect.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/tours/week.ts` | Week date keys, Sunday-start week array, addWeeks |
| `src/lib/tours/calendar-action.ts` | Pure + DB helpers for merge/replace/move/unassign/reorder |
| `src/pages/api/tours/calendar-action.ts` | JSON API entry |
| `src/components/TourWeekCalendar.astro` | Shared week grid markup |
| `src/pages/app/locales/[localeId]/tours/index.astro` | Workspace shell |
| `public/scripts/tours-calendar.js` | Selection, DnD, dialogs, autoroute refresh |
| `public/scripts/listing-tour-calendar.js` | Listing overlay week + merge-add |
| `src/styles/chrome.css` | Workspace layout + calendar (extend bases) |
| `tests/week.test.ts`, `tests/calendar-action.test.ts` | Unit tests |

---

### Task 1: Week date helpers

**Files:**
- Create: `src/lib/tours/week.ts`
- Test: `tests/week.test.ts`

**Interfaces:**
- Produces: `toDateKey(d: Date): string`, `parseDateKey(key: string): Date`, `startOfWeekSunday(d: Date): Date`, `weekDateKeys(anchor: Date): string[]` (7 keys), `addDays(d: Date, n: number): Date`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { toDateKey, startOfWeekSunday, weekDateKeys, addDays, parseDateKey } from '../src/lib/tours/week';

describe('week helpers', () => {
  it('toDateKey formats local YMD', () => {
    expect(toDateKey(new Date(2026, 7, 24))).toBe('2026-08-24');
  });

  it('weekDateKeys returns Sunday–Saturday containing anchor', () => {
    // Mon 2026-08-24 → week starts Sun 2026-08-23
    const keys = weekDateKeys(parseDateKey('2026-08-24'));
    expect(keys).toEqual([
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ]);
  });

  it('addDays shifts calendar date', () => {
    expect(toDateKey(addDays(parseDateKey('2026-08-29'), 1))).toBe('2026-08-30');
  });

  it('startOfWeekSunday is Sunday', () => {
    expect(toDateKey(startOfWeekSunday(parseDateKey('2026-08-24')))).toBe('2026-08-23');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/week.test.ts`

- [ ] **Step 3: Implement `src/lib/tours/week.ts`**

```ts
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) throw new Error(`Invalid date key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfWeekSunday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

export function weekDateKeys(anchor: Date): string[] {
  const start = startOfWeekSunday(anchor);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** `test: add week date helpers for tours calendar`

---

### Task 2: Calendar action core (pure + server helper)

**Files:**
- Create: `src/lib/tours/calendar-action.ts`
- Test: `tests/calendar-action.test.ts` (pure decision helpers only)

**Interfaces:**
- Produces:
  - `type ConflictMode = 'merge' | 'replace'`
  - `type CalendarActionRequest` (see API task)
  - `resolveOccupiedDrop(targetHasStops: boolean, mode?: ConflictMode): 'create' | 'merge' | 'replace' | 'need-choice'`
  - `applyCalendarAction(supabase, localeId, body): Promise<{ ok: true; tourDayId: string | null; optimized: boolean } | { ok: false; error: string; status: number }>`

- [ ] **Step 1: Pure helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveOccupiedDrop } from '../src/lib/tours/calendar-action';

describe('resolveOccupiedDrop', () => {
  it('empty target → create', () => {
    expect(resolveOccupiedDrop(false)).toBe('create');
  });
  it('occupied without mode → need-choice', () => {
    expect(resolveOccupiedDrop(true)).toBe('need-choice');
  });
  it('occupied + merge/replace', () => {
    expect(resolveOccupiedDrop(true, 'merge')).toBe('merge');
    expect(resolveOccupiedDrop(true, 'replace')).toBe('replace');
  });
});
```

- [ ] **Step 2: Implement helpers + `applyCalendarAction`**

Behavior for `applyCalendarAction`:

1. **assign** `{ listingIds, tourDate, mode? }`  
   - Upsert target day by `(locale_id, tour_date)`.  
   - If target has stops and no `mode` → return `{ ok:false, error:'need-choice', status:409 }`.  
   - If `replace`: delete all target stops (listings become unscheduled).  
   - Move each listing: delete stop from any other day in this locale; upsert onto target.  
   - Delete emptied source days.  
   - Clear target `encoded_polyline` until optimize.  
   - Call `optimizeTourDay` when possible (ensure a start: keep custom start; else keep `is_start`; else set first listing `is_start`). Soft-fail optimize: still return ok with `optimized:false` and `optimizeError`.

2. **unassign** `{ listingIds, tourDayId }` — same as today’s unassign loop; delete empty day.

3. **moveDay** `{ fromDate, toDate, mode? }` — load all listing ids on fromDate; if from===to no-op; treat as assign of those ids to toDate with mode; then delete from day if empty (assign already removes source stops). Preserve custom S/E from source onto target when create/replace; on merge keep target S/E.

4. **reorder** `{ tourDayId, listingIdsInOrder }` — update `sort_order`; clear polyline; optimize.

5. **assignCluster** — same as assign (listingIds + tourDate + mode).

- [ ] **Step 3: Tests pass for pure helpers; commit** `feat: calendar-action core for tour scheduling`

---

### Task 3: JSON API route

**Files:**
- Create: `src/pages/api/tours/calendar-action.ts`

- [ ] **Step 1: Implement**

```ts
// POST JSON { localeId, action: { type, ... } }
// Auth + getLocaleForNestMember
// return JSON from applyCalendarAction
```

Accept body:

```ts
type Body = {
  localeId: string;
  action:
    | { type: 'assign'; listingIds: string[]; tourDate: string; mode?: 'merge' | 'replace' }
    | { type: 'unassign'; listingIds: string[]; tourDayId: string }
    | { type: 'moveDay'; fromDate: string; toDate: string; mode?: 'merge' | 'replace' }
    | { type: 'reorder'; tourDayId: string; listingIdsInOrder: string[] };
};
```

- [ ] **Step 2: Commit** `feat: add /api/tours/calendar-action endpoint`

---

### Task 4: Shared week calendar component

**Files:**
- Create: `src/components/TourWeekCalendar.astro`

Props: `weekKeys: string[]`, `daysByDate: Record<string, { id: string; stopCount: number }>`, `selectedDate: string | null`, `idPrefix: string`

Markup: prev/next week buttons, 7 cells with `data-tour-date`, stop-count circle when `stopCount > 0`, selected state, droppable attribute.

- [ ] **Step 1: Add component**
- [ ] **Step 2: Commit** `feat: add TourWeekCalendar component`

---

### Task 5: Tours workspace page shell

**Files:**
- Modify: `src/pages/app/locales/[localeId]/tours/index.astro`
- Modify: `src/styles/chrome.css` (workspace layout — follow responsive-css)

Layout:

```
.tours-workspace
  .tours-workspace__rail (unscheduled + Auto-plan clusters; collapsed if empty)
  .tours-workspace__main
    TourWeekCalendar
    .tours-workspace__day (selected stops — reuse tours-stops markup from [id].astro)
  .tours-workspace__map
    #locale-map (hidden when day selected)
    #tour-map (hidden when no day / empty)
```

Seed `window.__WAYHOME_TOURS_CALENDAR__` with localeId, listings, tours+stops, google keys, locale center/radius.

Keep Plan overlay for manual preview optionally **or** remove Plan button and rely on Auto-plan in rail — **prefer:** Auto-plan in rail; remove header Plan CTA and old day list; keep Plan overlay code path deleted/simplified to Auto-plan only in rail.

Load scripts: `tours-calendar.js`, `tour-map.js`, `locale-map.js`, `place-search.js`, `listing-favorite.js`, `map-pin-hover.js` as needed.

- [ ] **Step 1: Rebuild page markup + data seed**
- [ ] **Step 2: Add CSS for `.tours-workspace` (stack on mobile; 3-col at 1024px)**
- [ ] **Step 3: Commit** `feat: tours calendar workspace shell`

---

### Task 6: Client calendar interactions

**Files:**
- Create: `public/scripts/tours-calendar.js`

Behaviors:

1. Click day cell → select; render stop list; show tour map or locale map; if day has stops and no polyline → `POST /api/tours/optimize` `{ tourDayId }` then refresh.
2. Drag listing from rail → day: if empty assign create; if occupied open Merge/Replace/Cancel overlay then `calendar-action`.
3. Drag listing from day → rail → unassign.
4. Multi-select (click with modifier or checkbox) + drag.
5. Drag day-dot → other date → moveDay + dialog if occupied.
6. Auto-plan button → `POST /api/tours/auto-plan` → show clusters in rail (draggable); drop cluster → assign with listingIds.
7. Reorder stops via drag within list → reorder action.
8. Set-as-start → existing `/api/tours/set-start` or calendar optimize after flag.
9. S/E buttons → overlay with place-search; POST `/api/tours/endpoints` then optimize.
10. Info “i” overlay with short copy.
11. Mobile: tap listing to select, tap day to assign (same conflict dialog).
12. Rebind on `astro:page-load` with AbortController.

After successful mutations: reload page **or** patch local state + re-fetch — **prefer full reload of tours page with `?day=YYYY-MM-DD` soft select** (spec said optional; use it for refresh simplicity).

- [ ] **Step 1: Implement script**
- [ ] **Step 2: Commit** `feat: tours calendar drag, select, and conflict overlay`

---

### Task 7: Listing tour overlay week UI

**Files:**
- Modify: `src/pages/app/locales/[localeId]/tours` wait — listings `[id].astro`
- Create: `public/scripts/listing-tour-calendar.js`

Replace date input / tour pick list with `TourWeekCalendar` + selected-day stop preview + **+** button that `POST /api/tours/calendar-action` assign merge always (pass `mode: 'merge'` when occupied; create when empty). No conflict dialog.

- [ ] **Step 1: Wire markup + script**
- [ ] **Step 2: Commit** `feat: listing add-to-tour uses week calendar`

---

### Task 8: Smoke verification

- [ ] **Step 1:** `npx vitest run`
- [ ] **Step 2:** `npm run build`
- [ ] **Step 3:** Manual checklist against spec (drag empty, merge/replace, listing +, S/E, auto-plan cluster)
- [ ] **Step 4:** Final commit if fixes needed

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| 3-column workspace | 5 |
| Week calendar shared | 4, 7 |
| Unscheduled rail + Auto-plan clusters | 5–6 |
| Drag assign / day↔day / reorder / day-dot | 2–3, 6 |
| Merge/Replace/Cancel; Replace → unscheduled | 2, 6 |
| Listing overlay silent merge | 7 |
| Autoroute / cache-ish reload | 6 |
| S/E buttons + overlay | 6 |
| Keyboard + i overlay | 6 |
| No hard redirect [id] | 5 (leave page) |
| Week helpers tests | 1 |

## Out of scope (explicit)

- Deleting `/tours/[id]`
- Soft appointment windows
- Cross-locale drag
