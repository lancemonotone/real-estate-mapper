const STORAGE_KEY = 'wayhome:matrix-favorite-filter';

function readMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'favorites' ? 'favorites' : 'all';
  } catch {
    return 'all';
  }
}

function writeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

function syncFilterButton(btn, mode) {
  const favoritesOnly = mode === 'favorites';
  btn.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
  btn.setAttribute(
    'aria-label',
    favoritesOnly ? 'Showing favorites only. Show all listings.' : 'Show favorites only',
  );
  btn.title = favoritesOnly ? 'Favorites only — click for all' : 'Show favorites only';
}

function applyFavoriteFilter(root = document) {
  const btn = root.querySelector('[data-matrix-favorite-filter]');
  if (!(btn instanceof HTMLButtonElement)) return;

  const mode = btn.getAttribute('aria-pressed') === 'true' ? 'favorites' : 'all';
  writeMode(mode);
  syncFilterButton(btn, mode);

  const tables = root.querySelectorAll('table.matrix-table');
  let anyVisible = false;
  let anyRows = false;

  tables.forEach((table) => {
    table.querySelectorAll('tbody tr[data-favorite]').forEach((tr) => {
      if (!(tr instanceof HTMLElement)) return;
      anyRows = true;
      const favorited = tr.dataset.favorite === '1';
      const hide = mode === 'favorites' && !favorited;
      tr.hidden = hide;
      if (!hide) anyVisible = true;
    });
  });

  root.querySelectorAll('[data-matrix-favorite-empty]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.hidden = !(mode === 'favorites' && anyRows && !anyVisible);
  });
}

function initMatrixFavoriteFilter() {
  const btn = document.querySelector('[data-matrix-favorite-filter]');
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.dataset.filterBound === '1') return;
  btn.dataset.filterBound = '1';

  const mode = readMode();
  syncFilterButton(btn, mode);
  applyFavoriteFilter(document);

  btn.addEventListener('click', () => {
    const next =
      btn.getAttribute('aria-pressed') === 'true' ? 'all' : 'favorites';
    syncFilterButton(btn, next);
    applyFavoriteFilter(document);
  });
}

document.addEventListener('listing-favorite-changed', () => {
  applyFavoriteFilter(document);
});

initMatrixFavoriteFilter();
document.addEventListener('astro:page-load', initMatrixFavoriteFilter);
