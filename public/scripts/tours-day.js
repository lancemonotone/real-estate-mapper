import { mountPlaceSearch } from './place-search.js';

function openPlanRouteOverlay() {
  const overlay = document.getElementById('tour-plan-route-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  document.body.classList.add('compare-column-overlay-open');
}

function closePlanRouteOverlay() {
  const overlay = document.getElementById('tour-plan-route-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  overlay.hidden = true;
  document.body.classList.remove('compare-column-overlay-open');
}

function setStatus(message) {
  const status = document.getElementById('plan-route-status');
  if (!(status instanceof HTMLElement)) return;
  if (!message) {
    status.hidden = true;
    status.textContent = '';
    return;
  }
  status.hidden = false;
  status.textContent = message;
}

function syncClearable(wrap) {
  const input = wrap.querySelector('[data-clearable-input]');
  const clearBtn = wrap.querySelector('[data-clearable-clear]');
  const flag = wrap.querySelector('[data-clearable-flag]');
  if (!(input instanceof HTMLInputElement) || !(clearBtn instanceof HTMLElement)) return;

  const hasValue = input.value.trim().length > 0;
  clearBtn.hidden = !hasValue;

  if (flag instanceof HTMLInputElement) {
    const hadSaved = input.dataset.hadSaved === '1';
    if (!hasValue && hadSaved) flag.value = '1';
    else if (hasValue) flag.value = '';
  }
}

function setEndpointPlace(searchRoot, place) {
  const latEl = searchRoot.querySelector('[data-endpoint-lat]');
  const lngEl = searchRoot.querySelector('[data-endpoint-lng]');
  const nameEl = searchRoot.querySelector('[data-endpoint-name]');
  const placeIdEl = searchRoot.querySelector('[data-endpoint-place-id]');
  if (latEl instanceof HTMLInputElement) {
    latEl.value =
      place?.lat != null && Number.isFinite(place.lat) ? String(place.lat) : '';
  }
  if (lngEl instanceof HTMLInputElement) {
    lngEl.value =
      place?.lng != null && Number.isFinite(place.lng) ? String(place.lng) : '';
  }
  if (nameEl instanceof HTMLInputElement) {
    nameEl.value = place?.name?.trim() || '';
  }
  if (placeIdEl instanceof HTMLInputElement) {
    placeIdEl.value = place?.placeId?.trim() || '';
  }
}

function mountEndpointSearch(rootId, localeId, signal) {
  const root = document.getElementById(rootId);
  if (!(root instanceof HTMLElement) || !localeId) return null;

  // Avoid stacking autocomplete listeners when page-load rebinds the overlay.
  if (root.dataset.searchMounted === '1') {
    const wrap = root.querySelector('.field-clearable');
    if (wrap instanceof HTMLElement) syncClearable(wrap);
    return null;
  }
  root.dataset.searchMounted = '1';

  const wrap = root.querySelector('.field-clearable');
  const clearBtn = root.querySelector('[data-clearable-clear]');
  const input = root.querySelector('[data-place-search-input]');

  const placeSearch = mountPlaceSearch(root, {
    localeId,
    onResolved(place) {
      setEndpointPlace(root, place);
      if (wrap instanceof HTMLElement) syncClearable(wrap);
    },
  });

  if (input instanceof HTMLInputElement) {
    input.addEventListener(
      'input',
      () => {
        setEndpointPlace(root, null);
        if (wrap instanceof HTMLElement) syncClearable(wrap);
      },
      { signal },
    );
  }

  if (clearBtn instanceof HTMLElement && wrap instanceof HTMLElement) {
    clearBtn.addEventListener(
      'click',
      () => {
        placeSearch.clear();
        setEndpointPlace(root, null);
        syncClearable(wrap);
        if (input instanceof HTMLInputElement) input.focus();
      },
      { signal },
    );
    syncClearable(wrap);
  }

  return placeSearch;
}

function initTourDay() {
  const overlay = document.getElementById('tour-plan-route-overlay');
  const form = document.querySelector('[data-tour-plan-route-form]');
  const cfg = window.__WAYHOME_TOUR_DAY__ || {};
  const tourId = cfg.tourId;
  const localeId = cfg.localeId;

  document.querySelectorAll('[data-appointment-time]').forEach((input) => {
    if (!(input instanceof HTMLInputElement) || input.dataset.appointmentBound === '1') return;
    input.dataset.appointmentBound = '1';
    input.addEventListener('change', async () => {
      const listingId = input.getAttribute('data-listing-id');
      if (!listingId || !tourId) return;
      const appointment_time = input.value.trim() || null;
      try {
        const res = await fetch('/api/tours/appointment-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            tour_day_id: tourId,
            listing_id: listingId,
            appointment_time,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(data.error || 'Could not save time');
          return;
        }
        location.reload();
      } catch {
        setStatus('Could not save time');
      }
    });
  });

  if (!(overlay instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !tourId) return;

  if (overlay._tourDayAbort instanceof AbortController) {
    overlay._tourDayAbort.abort();
  }
  const ac = new AbortController();
  overlay._tourDayAbort = ac;
  const { signal } = ac;

  document.querySelectorAll('[data-tour-plan-route-open]').forEach((el) => {
    el.addEventListener('click', () => openPlanRouteOverlay(), { signal });
  });
  overlay.querySelectorAll('[data-tour-plan-route-close]').forEach((el) => {
    el.addEventListener('click', () => closePlanRouteOverlay(), { signal });
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closePlanRouteOverlay();
    },
    { signal },
  );

  mountEndpointSearch('plan-route-start-search', localeId, signal);
  mountEndpointSearch('plan-route-end-search', localeId, signal);

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      setStatus('');
      const goBtn = form.querySelector('button[type="submit"]');
      if (goBtn instanceof HTMLButtonElement) goBtn.disabled = true;

      try {
        const endpointsRes = await fetch('/api/tours/endpoints', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        if (!endpointsRes.ok) {
          const text = await endpointsRes.text();
          setStatus(text || 'Could not save start / end.');
          closePlanRouteOverlay();
          return;
        }

        const optimizeRes = await fetch('/api/tours/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourDayId: tourId }),
        });
        const data = await optimizeRes.json().catch(() => ({}));
        if (!data.ok) {
          setStatus(data.error || 'Route optimize failed.');
          closePlanRouteOverlay();
          return;
        }
        location.reload();
      } finally {
        if (goBtn instanceof HTMLButtonElement) goBtn.disabled = false;
      }
    },
    { signal },
  );
}

document.addEventListener('astro:page-load', initTourDay);
