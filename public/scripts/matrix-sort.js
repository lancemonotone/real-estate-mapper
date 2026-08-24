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

  const headers = [...table.querySelectorAll('thead th[data-sort-type]')];
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

function bootMatrixSort() {
  document.querySelectorAll('table.matrix-table[data-sortable]').forEach((table) => {
    if (!(table instanceof HTMLTableElement)) return;
    if (table.dataset.sortBound === '1') return;
    table.dataset.sortBound = '1';
    initMatrixSort(table);
  });
}

bootMatrixSort();
document.addEventListener('astro:page-load', bootMatrixSort);
