const STORAGE_KEY = 'wayhome:favorites-filter';
const LEGACY_KEYS = ['wayhome:matrix-favorite-filter', 'wayhome:tours-favorite-filter'];

/** @type {Map<string, boolean>} */
const favoriteStateById = new Map();

function readMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'favorites' || raw === 'all') return raw;
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy === 'favorites' || legacy === 'all') {
        localStorage.setItem(STORAGE_KEY, legacy);
        return legacy;
      }
    }
    return 'all';
  } catch {
    return 'all';
  }
}

function writeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
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

function formatListingsCount(n) {
  return n === 1 ? '1 listing' : `${n} listings`;
}

function syncListingsCounts(root, mode) {
  root.querySelectorAll('[data-listings-count]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const all = Number(el.dataset.countAll ?? '0');
    const favorites = Number(el.dataset.countFavorites ?? '0');
    const n = mode === 'favorites' ? favorites : all;
    el.textContent = formatListingsCount(Number.isFinite(n) ? Math.max(0, n) : 0);
  });
}

function adjustFavoritedCount(root, favorited) {
  root.querySelectorAll('[data-listings-count]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    let fav = Number(el.dataset.countFavorites ?? '0');
    if (!Number.isFinite(fav)) fav = 0;
    fav = favorited ? fav + 1 : Math.max(0, fav - 1);
    el.dataset.countFavorites = String(fav);
  });
}

function seedFavoriteStates(root = document) {
  root.querySelectorAll('[data-favorite][data-listing-id]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const id = el.dataset.listingId;
    if (!id || id === 'custom-start' || id === 'custom-end') return;
    favoriteStateById.set(id, el.dataset.favorite === '1');
  });
}

/**
 * @returns {boolean} true when the stored favorite state changed
 */
function rememberFavoriteState(listingId, favorited) {
  const prev = favoriteStateById.get(listingId);
  if (prev === favorited) return false;
  favoriteStateById.set(listingId, favorited);
  return true;
}

function applyFavoriteFilter(root = document) {
  const btn =
    root.querySelector('[data-favorites-filter]') ||
    root.querySelector('[data-matrix-favorite-filter]') ||
    root.querySelector('[data-tours-favorite-filter]');
  if (!(btn instanceof HTMLButtonElement)) return;

  const mode = btn.getAttribute('aria-pressed') === 'true' ? 'favorites' : 'all';
  writeMode(mode);
  syncFilterButton(btn, mode);

  let anyRows = false;
  let anyVisible = false;

  root.querySelectorAll('table.matrix-table tbody tr[data-favorite]').forEach((tr) => {
    if (!(tr instanceof HTMLElement)) return;
    anyRows = true;
    const favorited = tr.dataset.favorite === '1';
    const hide = mode === 'favorites' && !favorited;
    tr.hidden = hide;
    if (!hide) anyVisible = true;
  });

  root.querySelectorAll('.tours-stops__item[data-favorite]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    anyRows = true;
    const favorited = el.dataset.favorite === '1';
    const timeInput = el.querySelector('[data-appointment-time]');
    const hasAppointment =
      el.dataset.hasAppointment === '1' ||
      (timeInput instanceof HTMLInputElement && timeInput.value.trim().length > 0);
    // Booked (timed) stops stay visible; favorites filter only hides untimed non-favorites.
    const hide = mode === 'favorites' && !favorited && !hasAppointment;
    el.hidden = hide;
    if (!hide) anyVisible = true;
  });

  root.querySelectorAll('[data-tours-unscheduled]').forEach((list) => {
    if (!(list instanceof HTMLElement)) return;
    const items = [...list.querySelectorAll(':scope > .tours-stops__item')];
    const anyItemVisible = items.some(
      (el) => el instanceof HTMLElement && !el.hidden,
    );
    list.hidden = !anyItemVisible;
  });

  root
    .querySelectorAll(
      '[data-matrix-favorite-empty], [data-tours-favorite-empty], [data-favorites-empty]',
    )
    .forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.hidden = !(mode === 'favorites' && anyRows && !anyVisible);
    });

  syncListingsCounts(root, mode);

  document.dispatchEvent(
    new CustomEvent('wayhome:favorites-filter-changed', { detail: { mode } }),
  );
}

function initFavoriteFilter() {
  const buttons = [
    ...document.querySelectorAll(
      '[data-favorites-filter], [data-matrix-favorite-filter], [data-tours-favorite-filter]',
    ),
  ].filter((el) => el instanceof HTMLButtonElement);
  if (!buttons.length) return;

  seedFavoriteStates(document);

  const mode = readMode();
  for (const btn of buttons) {
    if (btn.dataset.filterBound === '1') continue;
    btn.dataset.filterBound = '1';
    syncFilterButton(btn, mode);
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-pressed') === 'true' ? 'all' : 'favorites';
      for (const b of buttons) syncFilterButton(b, next);
      applyFavoriteFilter(document);
      document.dispatchEvent(new CustomEvent('wayhome:tour-map-refresh'));
      document.dispatchEvent(new CustomEvent('wayhome:locale-map-refresh'));
    });
  }
  applyFavoriteFilter(document);
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
    if (rememberFavoriteState(String(listingId), favorited)) {
      adjustFavoritedCount(document, favorited);
    }
  }
  applyFavoriteFilter(document);
});

initFavoriteFilter();
document.addEventListener('astro:page-load', initFavoriteFilter);
document.addEventListener('wayhome:tour-map-refresh', () => {
  queueMicrotask(() => applyFavoriteFilter(document));
});
