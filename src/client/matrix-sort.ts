import {
  applyMatrixSortClick,
  compareBySortStack,
  type MatrixSortKey,
} from '../lib/ui/matrix-sort-stack';

function sortValue(cell: Element | undefined): string | null {
  if (!(cell instanceof HTMLElement)) return null;
  const raw = cell.getAttribute('data-sort-value');
  if (raw == null || raw === '') return null;
  return raw;
}

function ensurePriorityEl(btn: HTMLButtonElement): HTMLElement {
  let el = btn.querySelector('.matrix-sort__priority');
  if (el instanceof HTMLElement) return el;
  el = document.createElement('span');
  el.className = 'matrix-sort__priority';
  el.hidden = true;
  btn.appendChild(el);
  return el;
}

function seedStackFromHeaders(headers: HTMLElement[]): MatrixSortKey[] {
  const stack: MatrixSortKey[] = [];
  headers.forEach((th, colIndex) => {
    const aria = th.getAttribute('aria-sort');
    if (aria === 'ascending') stack.push({ colIndex, dir: 'asc' });
    else if (aria === 'descending') stack.push({ colIndex, dir: 'desc' });
  });
  return stack;
}

function syncHeaderState(headers: HTMLElement[], stack: MatrixSortKey[]): void {
  const byCol = new Map(stack.map((k, i) => [k.colIndex, { ...k, priority: i + 1 }]));
  headers.forEach((th, colIndex) => {
    const btn = th.querySelector('.matrix-sort');
    if (!(btn instanceof HTMLButtonElement)) return;
    const priorityEl = ensurePriorityEl(btn);
    const entry = byCol.get(colIndex);
    if (!entry) {
      th.removeAttribute('aria-sort');
      priorityEl.textContent = '';
      priorityEl.hidden = true;
      return;
    }
    th.setAttribute(
      'aria-sort',
      entry.dir === 'asc' ? 'ascending' : 'descending',
    );
    priorityEl.textContent = String(entry.priority);
    priorityEl.hidden = false;
  });
}

function initMatrixSort(table: HTMLTableElement): void {
  const tbody = table.tBodies[0];
  if (!tbody) return;

  const panel = table.closest('.matrix-panel');
  const headTable = panel?.querySelector('.matrix-table--head');
  const headerRoot =
    headTable instanceof HTMLTableElement ? headTable : table;

  const headers = [...headerRoot.querySelectorAll('thead th[data-sort-type]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );

  let stack = seedStackFromHeaders(headers);
  syncHeaderState(headers, stack);

  headers.forEach((th, colIndex) => {
    const btn = th.querySelector('.matrix-sort');
    if (!(btn instanceof HTMLButtonElement)) return;
    ensurePriorityEl(btn);

    btn.addEventListener('click', () => {
      stack = applyMatrixSortClick(stack, colIndex);
      syncHeaderState(headers, stack);

      if (stack.length === 0) return;

      const rows = [...tbody.rows];
      rows.sort((rowA, rowB) =>
        compareBySortStack(
          stack,
          (c) => ({
            value: sortValue(rowA.cells[c]),
            type: headers[c]?.getAttribute('data-sort-type') || 'text',
          }),
          (c) => ({
            value: sortValue(rowB.cells[c]),
            type: headers[c]?.getAttribute('data-sort-type') || 'text',
          }),
        ),
      );
      for (const row of rows) tbody.appendChild(row);
    });
  });
}

function syncMatrixPanelScroll(panel: Element): void {
  const headScroll = panel.querySelector('.matrix-panel__head-table');
  const bodyScroll = panel.querySelector('.matrix-scroll');
  if (!(headScroll instanceof HTMLElement) || !(bodyScroll instanceof HTMLElement)) return;
  if (headScroll.dataset.scrollSyncBound === '1') return;
  headScroll.dataset.scrollSyncBound = '1';
  bodyScroll.addEventListener(
    'scroll',
    () => {
      headScroll.scrollLeft = bodyScroll.scrollLeft;
    },
    { passive: true },
  );
}

function bootMatrixPanels(): void {
  document.querySelectorAll('.matrix-panel').forEach((panel) => {
    syncMatrixPanelScroll(panel);
  });
}

function bootMatrixSort(): void {
  document.querySelectorAll('table.matrix-table[data-sortable]').forEach((table) => {
    if (!(table instanceof HTMLTableElement)) return;
    if (table.dataset.sortBound === '1') return;
    table.dataset.sortBound = '1';
    initMatrixSort(table);
  });
}

export function bootMatrixSortClient(): void {
  bootMatrixPanels();
  bootMatrixSort();
}

bootMatrixSortClient();
document.addEventListener('astro:page-load', bootMatrixSortClient);
