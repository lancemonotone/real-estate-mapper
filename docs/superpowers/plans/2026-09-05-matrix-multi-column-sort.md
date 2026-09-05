# Multi-column matrix sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Compare and Travel Times sort by multiple columns in priority order, with each header cycling ascending → descending → off.

**Architecture:** Extract pure stack-transition and multi-key compare helpers into `src/lib/ui/matrix-sort-stack.ts`. Drive DOM sorting from `public/scripts/matrix-sort.js` using an ordered stack per table. Seed the stack from SSR `aria-sort` so Compare’s default Value sort remains priority `#1` when the user adds tiebreakers. Extend `.matrix-sort` CSS for a priority digit.

**Tech Stack:** Astro, vanilla JS modules, Vitest, CSS in `chrome.css`.

## Global Constraints

- Branch: `feature/matrix-multi-column-sort` (already exists from staging; do not create a worktree).
- Spec: `docs/superpowers/specs/2026-09-05-matrix-multi-column-sort-design.md`
- No em dashes in user-facing copy.
- Fail Fast: no invented defaults; empty cells sort last within each key.
- No persistence (URL / sessionStorage).
- Scope: all `table.matrix-table[data-sortable]` only (not Listings page).
- CSS: extend `.matrix-sort`; mobile-first; nested `@media` only if needed; no BEM `&__` concatenation.
- Commit only when the plan step says to (or when the user asks).

## File map

| File | Role |
|------|------|
| `src/lib/ui/matrix-sort-stack.ts` | Pure: stack click transition + multi-key row compare |
| `tests/matrix-sort-stack.test.ts` | Unit tests for helpers |
| `public/scripts/matrix-sort.js` | Wire stack to headers / tbody; priority markers |
| `src/styles/chrome.css` | Priority digit next to ↑/↓ |

---

### Task 1: Pure sort-stack helpers + tests

**Files:**
- Create: `src/lib/ui/matrix-sort-stack.ts`
- Create: `tests/matrix-sort-stack.test.ts`

**Interfaces:**
- Produces:
  - `export type MatrixSortDir = 'asc' | 'desc'`
  - `export type MatrixSortKey = { colIndex: number; dir: MatrixSortDir }`
  - `export function applyMatrixSortClick(stack: MatrixSortKey[], colIndex: number): MatrixSortKey[]`
  - `export function compareMatrixSortValues(a: string | null, b: string | null, type: string, dir: MatrixSortDir): number`
  - `export function compareRowsBySortStack(getValue: (colIndex: number) => string | null, getType: (colIndex: number) => string, stack: MatrixSortKey[]): number` — actually better as comparing two row accessors; use:

```ts
export function compareBySortStack(
  stack: MatrixSortKey[],
  cellA: (colIndex: number) => { value: string | null; type: string },
  cellB: (colIndex: number) => { value: string | null; type: string },
): number
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  applyMatrixSortClick,
  compareBySortStack,
  compareMatrixSortValues,
  type MatrixSortKey,
} from '../src/lib/ui/matrix-sort-stack';

describe('applyMatrixSortClick', () => {
  it('appends a new column as ascending (newest last)', () => {
    const stack: MatrixSortKey[] = [{ colIndex: 1, dir: 'asc' }];
    expect(applyMatrixSortClick(stack, 3)).toEqual([
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'asc' },
    ]);
  });

  it('flips active ascending to descending without changing priority', () => {
    const stack: MatrixSortKey[] = [
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'asc' },
    ];
    expect(applyMatrixSortClick(stack, 3)).toEqual([
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'desc' },
    ]);
  });

  it('removes active descending and keeps relative order of the rest', () => {
    const stack: MatrixSortKey[] = [
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'desc' },
      { colIndex: 5, dir: 'asc' },
    ];
    expect(applyMatrixSortClick(stack, 3)).toEqual([
      { colIndex: 1, dir: 'asc' },
      { colIndex: 5, dir: 'asc' },
    ]);
  });

  it('does not mutate the input stack', () => {
    const stack: MatrixSortKey[] = [{ colIndex: 1, dir: 'asc' }];
    const next = applyMatrixSortClick(stack, 1);
    expect(stack).toEqual([{ colIndex: 1, dir: 'asc' }]);
    expect(next).toEqual([{ colIndex: 1, dir: 'desc' }]);
  });
});

describe('compareMatrixSortValues', () => {
  it('sorts empty last in both directions', () => {
    expect(compareMatrixSortValues(null, '1', 'number', 'asc')).toBe(1);
    expect(compareMatrixSortValues(null, '1', 'number', 'desc')).toBe(1);
  });

  it('compares numbers and text', () => {
    expect(compareMatrixSortValues('2', '10', 'number', 'asc')).toBeLessThan(0);
    expect(compareMatrixSortValues('b', 'a', 'text', 'asc')).toBeGreaterThan(0);
  });
});

describe('compareBySortStack', () => {
  it('uses later keys only when earlier keys tie', () => {
    const stack: MatrixSortKey[] = [
      { colIndex: 0, dir: 'asc' },
      { colIndex: 1, dir: 'desc' },
    ];
    const cells = [
      [
        { value: '1', type: 'number' },
        { value: 'a', type: 'text' },
      ],
      [
        { value: '1', type: 'number' },
        { value: 'z', type: 'text' },
      ],
    ];
    const cmp = compareBySortStack(
      stack,
      (c) => cells[0]![c]!,
      (c) => cells[1]![c]!,
    );
    // same col0; col1 desc => z before a => rowB before rowA => positive
    expect(cmp).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/matrix-sort-stack.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement helpers**

Create `src/lib/ui/matrix-sort-stack.ts`:

```ts
export type MatrixSortDir = 'asc' | 'desc';

export type MatrixSortKey = {
  colIndex: number;
  dir: MatrixSortDir;
};

export type MatrixSortCell = {
  value: string | null;
  type: string;
};

export function applyMatrixSortClick(
  stack: MatrixSortKey[],
  colIndex: number,
): MatrixSortKey[] {
  const idx = stack.findIndex((k) => k.colIndex === colIndex);
  if (idx === -1) {
    return [...stack, { colIndex, dir: 'asc' }];
  }
  const current = stack[idx]!;
  if (current.dir === 'asc') {
    return stack.map((k, i) => (i === idx ? { ...k, dir: 'desc' } : k));
  }
  return stack.filter((_, i) => i !== idx);
}

export function compareMatrixSortValues(
  a: string | null,
  b: string | null,
  type: string,
  dir: MatrixSortDir,
): number {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  let result = 0;
  if (type === 'number') {
    result = Number(a) - Number(b);
  } else {
    result = String(a).localeCompare(String(b), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  }
  return dir === 'desc' ? -result : result;
}

export function compareBySortStack(
  stack: MatrixSortKey[],
  cellA: (colIndex: number) => MatrixSortCell,
  cellB: (colIndex: number) => MatrixSortCell,
): number {
  for (const key of stack) {
    const a = cellA(key.colIndex);
    const b = cellB(key.colIndex);
    const result = compareMatrixSortValues(a.value, b.value, a.type, key.dir);
    if (result !== 0) return result;
  }
  return 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/matrix-sort-stack.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/matrix-sort-stack.ts tests/matrix-sort-stack.test.ts
git commit -m "$(cat <<'EOF'
feat: add pure multi-column matrix sort stack helpers

EOF
)"
```

---

### Task 2: Wire multi-sort into `matrix-sort.js` + priority CSS

**Files:**
- Modify: `public/scripts/matrix-sort.js`
- Modify: `src/styles/chrome.css` (`.matrix-sort` block ~3614)

**Interfaces:**
- Consumes: `applyMatrixSortClick`, `compareBySortStack` from `/src/lib/ui/matrix-sort-stack.ts` via Vite-capable import path used elsewhere in `public/scripts` — **check existing pattern**. If `public/scripts` cannot import from `src/lib`, duplicate is forbidden: either move the script under `src/client/` and import from pages, **or** keep helpers logic inlined by importing through Astro-bundled client. Prefer: change pages to load a client module, but YAGNI — inspect how other public scripts import lib code.

**Research step (required before coding):** Grep `public/scripts` for imports from `../src` or `/src`. If none work, put the pure module at `src/lib/ui/matrix-sort-stack.ts` and have `matrix-sort.js` re-implement by importing from a path Astro resolves. Looking at AppLayout: some scripts are `/scripts/*.js` static; others are `import '../client/...'`. **Chosen approach for this plan:** convert Compare/Travel Times to also load sort via a thin `src/client/matrix-sort.ts` that imports the lib helpers, **or** keep `public/scripts/matrix-sort.js` and use:

```js
import {
  applyMatrixSortClick,
  compareBySortStack,
} from '../../src/lib/ui/matrix-sort-stack.ts';
```

Vite/Astro may not serve that from `/scripts/`. Safest approach matching the repo:

1. Create `src/client/matrix-sort.ts` that contains the DOM wiring and imports helpers from `../lib/ui/matrix-sort-stack`.
2. Replace `<script src="/scripts/matrix-sort.js">` in Compare + Travel Times with:

```astro
<script>
  import '../../../../client/matrix-sort';
</script>
```

(Adjust relative path per file depth.)

3. Leave `public/scripts/matrix-sort.js` as a re-export shim **or** delete after pages updated — prefer delete only if nothing else references it. Grep first.

**Seed SSR stack:** On init, for each header with `aria-sort="ascending"|"descending"` in document order, push `{ colIndex, dir }` into the stack **without** re-sorting rows (SSR already ordered).

**DOM priority mark:** Ensure each `.matrix-sort` button has a child:

```html
<span class="matrix-sort__priority" hidden></span>
```

Create it in JS if missing. Sync: for stack index `i`, set text to `String(i + 1)`, `hidden = false`; clear/hide when inactive.

**Click handler sketch:**

```ts
btn.addEventListener('click', () => {
  stack = applyMatrixSortClick(stack, colIndex);
  syncHeaderState(headers, stack);
  const rows = [...tbody.rows];
  rows.sort((rowA, rowB) =>
    compareBySortStack(
      stack,
      (c) => cellOf(rowA, c, headers),
      (c) => cellOf(rowB, c, headers),
    ),
  );
  for (const row of rows) tbody.appendChild(row);
});
```

`cellOf` reads `data-sort-value` from `row.cells[c]` and `data-sort-type` from `headers[c]`.

- [ ] **Step 1: Grep for `matrix-sort.js` references and choose load path**

Run: `rg "matrix-sort" -g '!*.next/**' -g '!node_modules/**'`

Update Compare + Travel Times script tags to Astro client import if needed.

- [ ] **Step 2: Implement client wiring** (`src/client/matrix-sort.ts` or updated `public/scripts/matrix-sort.js`)

Preserve: sticky head-table header root, `data-sort-bound`, panel scroll sync, `astro:page-load` boot.

- [ ] **Step 3: CSS for priority**

In `.matrix-sort` (extend existing):

```css
.matrix-sort {
  /* existing rules… */

  & .matrix-sort__priority {
    margin-inline-start: 0.25rem;
    font-size: 0.75em;
    font-weight: 700;
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
  }

  /* Keep ::after arrow after the priority span visually:
     structure: [label text][priority][::after arrow]
     Use order or ensure priority is inserted before end. */
}
```

Do not use BEM `&__priority`. Use full `.matrix-sort__priority` under `.matrix-sort`.

- [ ] **Step 4: Manual smoke (or Playwright if already easy)**

Verify checklist from spec §Verification on Compare + Travel Times.

- [ ] **Step 5: Commit**

```bash
git add public/scripts/matrix-sort.js src/client/matrix-sort.ts src/styles/chrome.css \
  src/pages/app/locales/[localeId]/compare.astro \
  src/pages/app/locales/[localeId]/travel-times.astro
git commit -m "$(cat <<'EOF'
feat: multi-column sort stack for Compare and Travel Times

EOF
)"
```

---

### Task 3: Plan doc commit (if not already)

**Files:**
- Create: `docs/superpowers/plans/2026-09-05-matrix-multi-column-sort.md` (this file)

- [ ] **Step 1: Ensure this plan is committed on the feature branch**

```bash
git add docs/superpowers/plans/2026-09-05-matrix-multi-column-sort.md
git commit -m "$(cat <<'EOF'
docs: multi-column matrix sort implementation plan

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Ordered sort stack | Task 1–2 |
| asc → desc → off | Task 1 `applyMatrixSortClick` |
| Newest last | Task 1 |
| Re-click does not reshuffle priority | Task 1 |
| Compare + Travel Times | Task 2 |
| ↑/↓ + priority digit | Task 2 |
| Empty last | Task 1 `compareMatrixSortValues` |
| No persistence | implied |
| SSR Value default remains #1 when adding keys | Task 2 seed from `aria-sort` |

## Placeholder scan

None intentional. Load-path choice resolved in Task 2 Step 1 with a concrete decision tree.
