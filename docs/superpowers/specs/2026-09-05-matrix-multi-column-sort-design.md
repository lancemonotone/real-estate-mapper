# Wayhome — Multi-column matrix sort

**Date:** 2026-09-05  
**Status:** Approved (conversation)  
**Repo:** https://github.com/lancemonotone/real-estate-mapper  
**Related:**  
- `public/scripts/matrix-sort.js`  
- Compare: `src/pages/app/locales/[localeId]/compare.astro`  
- Travel Times: `src/pages/app/locales/[localeId]/travel-times.astro`

## Problem

Matrix tables (Compare, Travel Times) support only **one** active sort column. Clicking a header clears other columns. Users want to sort by several columns **in priority order** (primary, then tiebreakers).

## Goals

1. Support an ordered **sort stack** of one or more columns.
2. Click interaction: inactive → add; active → cycle direction / remove. No separate clear control.
3. Same behavior on **Compare and Travel Times** (shared `matrix-sort.js`).
4. Show active direction (↑/↓) and priority (`1`, `2`, …) on headers.
5. Keep empty-cell-last behavior within each sort key.

## Non-goals

- Persisting sort stack across navigation or reload (`sessionStorage` / URL).
- Reordering priority by clicking (no “promote to primary” on re-click).
- Drag-reorder of sort keys.
- Changing default SSR sort until the user clicks a header.
- Multi-sort on the Listings page (`listings-sort.js` is out of scope).

## Decisions

| Topic | Choice |
|-------|--------|
| Interaction | Every click participates (no Shift+click) |
| Cycle | Inactive → **ascending** (append). Active: **asc → desc → off** |
| Priority on add | Newest column is **primary** (`#1`). Prior keys shift down as tiebreakers |
| Re-click priority | Direction / off only; does **not** change order in the stack |
| Off | Remove from stack; remaining keys keep relative order and renumber |
| Scope | All `table.matrix-table[data-sortable]` (Compare + Travel Times) |
| Persistence | None in v1 |
| Empty cells | Sort last within that key (existing `compareValues` behavior) |

## Behavior

### Sort stack

Per table, maintain an ordered list:

```ts
{ colIndex: number; dir: 'asc' | 'desc' }[]
```

Index `0` is primary. Comparator walks the list until a non-zero result.

### Header clicks

1. Column **not** in stack → insert `{ colIndex, dir: 'asc' }` at the **front** (new primary), apply sort.
2. Column **in** stack with `asc` → set `desc` (priority unchanged).
3. Column **in** stack with `desc` → remove from stack; renumber remaining.
4. If stack becomes empty → leave row order as last sorted order (do not restore SSR default mid-session).

### UI

- Keep existing `aria-sort="ascending" | "descending"` on active headers; remove when off.
- Keep ↑ / ↓ via existing `.matrix-sort::after` rules.
- Add a compact priority mark (e.g. `1`, `2`) next to the arrow on each active column only.
- Inactive sortable headers show no arrow and no number.

### Accessibility

- `aria-sort` remains the source of truth for direction on each `th`.
- Optional: update button `aria-label` / `title` to include priority when active (e.g. “Sort by Value, priority 1, ascending”). Fail Fast: if labels are omitted, at least keep `aria-sort` correct.

## Implementation sketch

**Primary file:** `public/scripts/matrix-sort.js`

- Replace single-column clear-on-click with stack logic above.
- `rows.sort` comparator: for each stack entry, `compareValues` on that column’s `data-sort-value` / `data-sort-type`.
- Sync all headers’ `aria-sort` and priority markers from the stack after each click.
- Preserve sticky head-table path (`matrix-table--head` vs body table) already used for header lookup.
- Guard with existing `data-sort-bound` so Astro soft nav does not double-bind.

**CSS:** `src/styles/chrome.css` (`.matrix-sort`)

- Extend header control to show priority digit beside the direction glyph.
- Mobile-first; no new one-off button chrome (extend `.matrix-sort` only).

**Markup:** Prefer no Astro changes if priority can be injected by JS into the existing button. If a stable hook is needed, add an empty `<span class="matrix-sort__priority" hidden></span>` in Compare / Travel Times headers only when that is cleaner than creating nodes in JS.

**Tests:** Prefer a small pure helper extract (stack transition + multi-key compare) under `src/lib/` or testable module if extraction is cheap; otherwise manual smoke on Compare + Travel Times.

## Verification

1. Compare: click Value → beds → price. Order is Value primary, then beds, then price. Headers show `1` `2` `3` with arrows.
2. Click beds again → beds flips to desc; still priority `2`.
3. Click beds again → beds off; price becomes `2`.
4. Travel Times: same cycle and multi-key behavior on Listing / criterion columns.
5. Favorites filter still hides rows; sort applies to current DOM row set.
6. Soft navigate away and back → sort stack resets (expected).

## Out of scope follow-ups

- Persist stack in URL or `sessionStorage`.
- Click-to-promote or drag to reorder priorities.
- Mirror multi-sort on Listings page dropdown sorter.
