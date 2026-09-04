const STORAGE_KEY = 'wayhome:tours-favorite-filter';

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
  btn.title = favoritesOnly ? 'Favorites only. Click for all.' : 'Show favorites only';
}

function applyToursFavoriteFilter(root = document) {
  const btn = root.querySelector('[data-tours-favorite-filter]');
  if (!(btn instanceof HTMLButtonElement)) return;

  const mode = btn.getAttribute('aria-pressed') === 'true' ? 'favorites' : 'all';
  writeMode(mode);
  syncFilterButton(btn, mode);

  let anyRows = false;
  let anyVisible = false;

  root.querySelectorAll('.tours-stops__item[data-favorite]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    anyRows = true;
    const favorited = el.dataset.favorite === '1';
    const hide = mode === 'favorites' && !favorited;
    el.hidden = hide;
    if (!hide) anyVisible = true;
  });

  root.querySelectorAll('[data-map-pin-favorite]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const favorited = el.dataset.mapPinFavorite === '1';
    const hide = mode === 'favorites' && !favorited;
    el.hidden = hide;
    const markerHost = el.closest('[data-map-pin-host]');
    if (markerHost instanceof HTMLElement) {
      markerHost.hidden = hide;
    }
  });

  root.querySelectorAll('[data-tours-favorite-empty]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.hidden = !(mode === 'favorites' && anyRows && !anyVisible);
  });
}

function initToursFavoriteFilter() {
  const btn = document.querySelector('[data-tours-favorite-filter]');
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.dataset.filterBound === '1') return;
  btn.dataset.filterBound = '1';

  const mode = readMode();
  syncFilterButton(btn, mode);
  applyToursFavoriteFilter(document);

  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-pressed') === 'true' ? 'all' : 'favorites';
    syncFilterButton(btn, next);
    applyToursFavoriteFilter(document);
    document.dispatchEvent(new CustomEvent('wayhome:tour-map-refresh'));
    document.dispatchEvent(new CustomEvent('wayhome:locale-map-refresh'));
  });
}

document.addEventListener('listing-favorite-changed', (event) => {
  const detail = event instanceof CustomEvent ? event.detail : null;
  const listingId = detail?.listingId;
  const favorited = detail?.favorited;
  if (listingId != null && typeof favorited === 'boolean') {
    document.querySelectorAll(`[data-listing-id="${listingId}"]`).forEach((el) => {
      if (el instanceof HTMLElement && el.hasAttribute('data-favorite')) {
        el.dataset.favorite = favorited ? '1' : '0';
      }
    });
    document.querySelectorAll(`[data-map-listing-id="${listingId}"]`).forEach((el) => {
      if (el instanceof HTMLElement) {
        el.dataset.mapPinFavorite = favorited ? '1' : '0';
      }
    });
  }
  applyToursFavoriteFilter(document);
});

initToursFavoriteFilter();
document.addEventListener('astro:page-load', initToursFavoriteFilter);
document.addEventListener('wayhome:tour-map-refresh', () => {
  queueMicrotask(() => applyToursFavoriteFilter(document));
});
