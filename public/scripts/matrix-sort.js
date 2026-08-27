function sortValue(cell) {
  const raw = cell.getAttribute('data-sort-value');
  if (raw == null || raw === '') return null;
  return raw;
}

function compareValues(a, b, type, dir) {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  let result = 0;
  if (type === 'number') {
    result = Number(a) - Number(b);
  } else {
    result = String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
  }
  return dir === 'desc' ? -result : result;
}

function initMatrixSort(table) {
  const tbody = table.tBodies[0];
  if (!tbody) return;

  const panel = table.closest('.matrix-panel');
  const headTable = panel?.querySelector('.matrix-table--head');
  const headerRoot =
    headTable instanceof HTMLTableElement ? headTable : table;

  const headers = [...headerRoot.querySelectorAll('thead th[data-sort-type]')];
  headers.forEach((th, colIndex) => {
    const type = th.getAttribute('data-sort-type') || 'text';
    const btn = th.querySelector('.matrix-sort');
    if (!(btn instanceof HTMLButtonElement)) return;

    btn.addEventListener('click', () => {
      const current = th.getAttribute('aria-sort');
      const next = current === 'ascending' ? 'descending' : 'ascending';
      headers.forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', next);

      const dir = next === 'ascending' ? 'asc' : 'desc';
      const rows = [...tbody.rows];
      rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[colIndex];
        const cellB = rowB.cells[colIndex];
        return compareValues(sortValue(cellA), sortValue(cellB), type, dir);
      });
      for (const row of rows) tbody.appendChild(row);
    });
  });
}

function syncMatrixPanelScroll(panel) {
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

function bootMatrixPanels() {
  document.querySelectorAll('.matrix-panel').forEach((panel) => {
    syncMatrixPanelScroll(panel);
  });
}

function bootMatrixSort() {
  document.querySelectorAll('table.matrix-table[data-sortable]').forEach((table) => {
    if (!(table instanceof HTMLTableElement)) return;
    if (table.dataset.sortBound === '1') return;
    table.dataset.sortBound = '1';
    initMatrixSort(table);
  });
}

bootMatrixPanels();
bootMatrixSort();
document.addEventListener('astro:page-load', () => {
  bootMatrixPanels();
  bootMatrixSort();
});
