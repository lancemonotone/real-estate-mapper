function mountOverlayOnBody(overlay) {
  // .app-main.glass uses backdrop-filter, which makes position:fixed relative to
  // main instead of the viewport — reparent so the dialog centers on screen.
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
}

function openListingOverlay(name) {
  const overlay = document.querySelector(`[data-listing-overlay="${name}"]`);
  if (!(overlay instanceof HTMLElement)) return;
  document.querySelectorAll('[data-listing-overlay]').forEach((el) => {
    if (el instanceof HTMLElement) el.hidden = true;
  });
  mountOverlayOnBody(overlay);
  overlay.hidden = false;
  document.body.classList.add('compare-column-overlay-open');
}

function closeListingOverlays() {
  document.querySelectorAll('[data-listing-overlay]').forEach((el) => {
    if (el instanceof HTMLElement) el.hidden = true;
  });
  document.body.classList.remove('compare-column-overlay-open');
}

window.__WAYHOME_LISTING_OVERLAY__ = {
  open: openListingOverlay,
  close: closeListingOverlays,
};

function initListingDetail() {
  if (document.body._listingDetailAbort instanceof AbortController) {
    document.body._listingDetailAbort.abort();
  }
  const ac = new AbortController();
  document.body._listingDetailAbort = ac;
  const { signal } = ac;

  document.querySelectorAll('[data-listing-overlay]').forEach((el) => {
    if (el instanceof HTMLElement) mountOverlayOnBody(el);
  });

  document.querySelectorAll('[data-listing-overlay-open]').forEach((el) => {
    el.addEventListener(
      'click',
      () => {
        const name = el.getAttribute('data-listing-overlay-open');
        if (name === 'place') {
          window.dispatchEvent(
            new CustomEvent('listing-place-picker', {
              detail: { mode: 'add-listing' },
            }),
          );
          return;
        }
        if (name) openListingOverlay(name);
      },
      { signal },
    );
  });
  document.querySelectorAll('[data-listing-overlay-close]').forEach((el) => {
    el.addEventListener('click', () => closeListingOverlays(), { signal });
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const open = [...document.querySelectorAll('[data-listing-overlay]')].some(
        (el) => el instanceof HTMLElement && !el.hidden,
      );
      if (open) closeListingOverlays();
    },
    { signal },
  );
}

initListingDetail();
document.addEventListener('astro:page-load', initListingDetail);
