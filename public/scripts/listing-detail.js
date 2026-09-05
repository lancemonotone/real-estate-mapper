function purgeStaleListingOverlays() {
  document.querySelectorAll('body > [data-listing-overlay]').forEach((el) => {
    el.remove();
  });
}

function notifyListingFormsBind(root) {
  window.dispatchEvent(
    new CustomEvent('wayhome:listing-forms-bind', {
      detail: root ? { root } : undefined,
    }),
  );
}

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
  if (name === 'new') {
    const importForm = overlay.querySelector('#import-form');
    if (importForm instanceof HTMLFormElement) importForm.reset();
    const createForm = overlay.querySelector('form[action="/api/listings/create"]');
    if (createForm instanceof HTMLFormElement) createForm.reset();
    const galleryList = overlay.querySelector('[data-gallery-list]');
    if (galleryList) galleryList.replaceChildren();
    const status = overlay.querySelector('#import-status');
    if (status) status.textContent = '';
  }
  mountOverlayOnBody(overlay);
  overlay.hidden = false;
  document.body.classList.add('compare-column-overlay-open');
  notifyListingFormsBind(overlay);
}

function waitForAutosaveIdle(form) {
  return new Promise((resolve) => {
    const tick = () => {
      if (form.dataset.listingAutosaveBusy === '1') {
        window.setTimeout(tick, 120);
        return;
      }
      resolve();
    };
    tick();
  });
}

async function closeListingOverlays() {
  const editForm = document.querySelector(
    '[data-listing-overlay="edit"] form[data-listing-autosave]',
  );
  const hadPendingSave =
    editForm instanceof HTMLFormElement &&
    (editForm.dataset.listingAutosaveDirty === '1' ||
      editForm.dataset.listingAutosaveBusy === '1');

  document.querySelectorAll('[data-listing-overlay]').forEach((el) => {
    if (el instanceof HTMLElement) el.hidden = true;
  });
  document.body.classList.remove('compare-column-overlay-open');

  if (!(editForm instanceof HTMLFormElement)) return;

  if (hadPendingSave) {
    editForm.dispatchEvent(new CustomEvent('listing-autosave-flush'));
    await waitForAutosaveIdle(editForm);
  } else if (editForm.dataset.listingAutosaved === '1') {
    await window.__WAYHOME_REFRESH_LISTING_SURFACE__?.();
  }
}

window.__WAYHOME_LISTING_OVERLAY__ = {
  open: openListingOverlay,
  close: closeListingOverlays,
};

function maybeOpenNewListingFromQuery() {
  const params = new URLSearchParams(location.search);
  if (params.get('new') !== '1') return;
  if (!document.querySelector('[data-listing-overlay="new"]')) return;
  openListingOverlay('new');
  params.delete('new');
  const next = params.toString();
  const path = `${location.pathname}${next ? `?${next}` : ''}${location.hash}`;
  history.replaceState({}, '', path);
}

function initListingDetail() {
  if (document.body._listingDetailAbort instanceof AbortController) {
    document.body._listingDetailAbort.abort();
  }
  const ac = new AbortController();
  document.body._listingDetailAbort = ac;
  const { signal } = ac;

  const view = document.querySelector('.app-main__view');
  (view ?? document).querySelectorAll('[data-listing-overlay]').forEach((el) => {
    if (el instanceof HTMLElement) mountOverlayOnBody(el);
  });

  notifyListingFormsBind();

  document.querySelectorAll('[data-listing-overlay-open]').forEach((el) => {
    el.addEventListener(
      'click',
      () => {
        const cap = window.__WAYHOME_LISTING_CAP__;
        const name = el.getAttribute('data-listing-overlay-open');
        if (cap?.blocked && name === 'new') return;
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

  document.querySelectorAll('[data-listing-delete-confirm]').forEach((el) => {
    el.addEventListener(
      'click',
      async () => {
        if (!(el instanceof HTMLButtonElement)) return;
        const listingId = el.getAttribute('data-listing-id');
        const localeId = el.getAttribute('data-locale-id');
        if (!listingId || !localeId) return;

        const overlay = document.querySelector('[data-listing-overlay="delete"]');
        const errorEl =
          overlay instanceof HTMLElement
            ? overlay.querySelector('[data-listing-delete-error]')
            : null;
        if (errorEl instanceof HTMLElement) {
          errorEl.hidden = true;
          errorEl.textContent = '';
        }

        el.disabled = true;
        try {
          const res = await fetch('/api/listings/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ listingId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            el.disabled = false;
            if (errorEl instanceof HTMLElement) {
              errorEl.hidden = false;
              errorEl.textContent =
                typeof data.error === 'string' ? data.error : 'Delete failed';
            }
            return;
          }
          window.location.href = `/app/locales/${encodeURIComponent(localeId)}`;
        } catch {
          el.disabled = false;
          if (errorEl instanceof HTMLElement) {
            errorEl.hidden = false;
            errorEl.textContent = 'Delete failed';
          }
        }
      },
      { signal },
    );
  });

  maybeOpenNewListingFromQuery();
}

initListingDetail();
document.addEventListener('astro:page-load', initListingDetail);
document.addEventListener('astro:before-swap', () => {
  document.querySelectorAll('body > [data-listing-overlay]').forEach((el) => {
    el.remove();
  });
  document.body.classList.remove('compare-column-overlay-open');
});
