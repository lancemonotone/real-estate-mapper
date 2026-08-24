function syncFavoriteButtons(listingId, favorited) {
  document.querySelectorAll(`[data-favorite-toggle][data-listing-id="${listingId}"]`).forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    el.setAttribute('aria-pressed', favorited ? 'true' : 'false');
    el.setAttribute('aria-label', favorited ? 'Remove favorite' : 'Favorite');
    el.title = favorited ? 'Favorited' : 'Favorite';
  });
}

async function onFavoriteClick(e) {
  const btn = e.target instanceof Element ? e.target.closest('[data-favorite-toggle]') : null;
  if (!(btn instanceof HTMLButtonElement)) return;

  e.preventDefault();
  e.stopPropagation();

  const listingId = btn.dataset.listingId;
  if (!listingId) return;

  const next = btn.getAttribute('aria-pressed') !== 'true';
  btn.disabled = true;
  syncFavoriteButtons(listingId, next);

  try {
    const res = await fetch('/api/listings/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ listingId, favorite: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      syncFavoriteButtons(listingId, !next);
      console.error(data.error || 'Favorite update failed');
    }
  } catch (err) {
    syncFavoriteButtons(listingId, !next);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('click', onFavoriteClick);
