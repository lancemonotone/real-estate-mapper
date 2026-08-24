function sortValue(li, key) {
  const raw = li.getAttribute(`data-sort-${key}`);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function compare(a, b, key, dir) {
  const emptyA = a == null;
  const emptyB = b == null;
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  const result = a - b;
  return dir === 'desc' ? -result : result;
}

function initListingsSort() {
  const select = document.querySelector('[data-listings-sort]');
  const list = document.querySelector('[data-listings-list]');
  if (!(select instanceof HTMLSelectElement) || !(list instanceof HTMLElement)) return;
  if (select.dataset.sortBound === '1') return;
  select.dataset.sortBound = '1';

  const apply = () => {
    const key = select.value;
    const dir = key === 'recent' ? 'desc' : 'asc';
    const items = [...list.children].filter((el) => el instanceof HTMLElement);
    items.sort((a, b) => compare(sortValue(a, key), sortValue(b, key), key, dir));
    for (const item of items) list.appendChild(item);
  };

  select.addEventListener('change', apply);
}

initListingsSort();
document.addEventListener('astro:page-load', initListingsSort);
