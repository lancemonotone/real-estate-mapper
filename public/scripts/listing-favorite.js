function syncReactionButtons(listingId, reaction) {
  const favorited = Boolean(reaction.favorite);
  const passed = Boolean(reaction.passed);

  document.querySelectorAll(`[data-favorite-toggle][data-listing-id="${listingId}"]`).forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    el.setAttribute('aria-pressed', favorited ? 'true' : 'false');
    el.setAttribute('aria-label', favorited ? 'Remove favorite' : 'Favorite');
    el.title = favorited ? 'Favorited' : 'Favorite';
  });

  document.querySelectorAll(`[data-passed-toggle][data-listing-id="${listingId}"]`).forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    el.setAttribute('aria-pressed', passed ? 'true' : 'false');
    el.setAttribute('aria-label', passed ? 'Remove passed mark' : 'Mark as passed');
    el.title = passed ? 'Passed' : 'Pass';
  });

  document.querySelectorAll(`[data-listing-id="${listingId}"]`).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.hasAttribute('data-favorite')) {
      el.dataset.favorite = favorited ? '1' : '0';
    }
    if (el.hasAttribute('data-passed')) {
      el.dataset.passed = passed ? '1' : '0';
    }
  });

  document.dispatchEvent(
    new CustomEvent('listing-favorite-changed', {
      detail: { listingId, favorited, passed },
    }),
  );
  document.dispatchEvent(
    new CustomEvent('listing-reaction-changed', {
      detail: { listingId, favorite: favorited, passed },
    }),
  );
}

function readReactionFromButtons(listingId) {
  const fav = document.querySelector(`[data-favorite-toggle][data-listing-id="${listingId}"]`);
  const pass = document.querySelector(`[data-passed-toggle][data-listing-id="${listingId}"]`);
  return {
    favorite: fav instanceof HTMLButtonElement && fav.getAttribute('aria-pressed') === 'true',
    passed: pass instanceof HTMLButtonElement && pass.getAttribute('aria-pressed') === 'true',
  };
}

async function postReaction(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Reaction update failed');
  }
  return {
    favorite: Boolean(data.favorite),
    passed: Boolean(data.passed),
  };
}

async function onReactionClick(e) {
  const favBtn =
    e.target instanceof Element ? e.target.closest('[data-favorite-toggle]') : null;
  const passBtn =
    e.target instanceof Element ? e.target.closest('[data-passed-toggle]') : null;
  const btn = favBtn || passBtn;
  if (!(btn instanceof HTMLButtonElement)) return;

  e.preventDefault();
  e.stopPropagation();

  const listingId = btn.dataset.listingId;
  if (!listingId) return;

  const kind = favBtn ? 'favorite' : 'passed';
  const next = btn.getAttribute('aria-pressed') !== 'true';
  const previous = readReactionFromButtons(listingId);
  const optimistic =
    kind === 'favorite'
      ? { favorite: next, passed: next ? false : previous.passed }
      : { favorite: next ? false : previous.favorite, passed: next };

  btn.disabled = true;
  syncReactionButtons(listingId, optimistic);

  try {
    const reaction =
      kind === 'favorite'
        ? await postReaction('/api/listings/favorite', { listingId, favorite: next })
        : await postReaction('/api/listings/passed', { listingId, passed: next });
    syncReactionButtons(listingId, reaction);
  } catch (err) {
    syncReactionButtons(listingId, previous);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('click', onReactionClick);
