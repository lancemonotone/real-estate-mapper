/**
 * Locale Tours calendar workspace: select week days, drag assign, conflict overlay, S/E.
 */
import { mountPlaceSearch } from './place-search.js';

function seed() {
  return window.__WAYHOME_TOURS_CALENDAR__ ?? null;
}

function statusEl() {
  return document.getElementById('tours-calendar-status');
}

function showStatus(message, isError = true) {
  const el = statusEl();
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('alert--error', Boolean(message) && isError);
  el.classList.toggle('is-empty', !message);
}

function openOverlay(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) return;
  if (el.parentElement !== document.body) {
    document.body.appendChild(el);
  }
  el.hidden = false;
  document.body.classList.add('compare-column-overlay-open');
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  const anyOpen = document.querySelector('.compare-column-overlay:not([hidden])');
  if (!anyOpen) document.body.classList.remove('compare-column-overlay-open');
}

function reloadForDay(day) {
  const cfg = seed();
  if (!cfg?.toursBase) return;
  const url = new URL(cfg.toursBase, window.location.origin);
  if (day) url.searchParams.set('day', day);
  else url.searchParams.delete('day');
  // Bust soft-nav / bfcache so map polyline always re-SSR after mutations.
  url.searchParams.set('_r', String(Date.now()));
  window.location.assign(url.pathname + url.search);
}

function weekShift(deltaWeeks) {
  const root = document.querySelector('[data-tour-week]');
  const first = root?.querySelector('[data-tour-date]')?.getAttribute('data-tour-date');
  if (!first) return;
  const [y, m, d] = first.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaWeeks * 7);
  const key = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  reloadForDay(key);
}

async function postAction(action) {
  const cfg = seed();
  if (!cfg?.localeId) throw new Error('Missing calendar config');
  const res = await fetch('/api/tours/calendar-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ localeId: cfg.localeId, action }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 && data.error === 'need-choice') {
    return { needChoice: true };
  }
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Request failed');
  }
  return data;
}

/** @type {{ kind: 'assign' | 'moveDay', listingIds?: string[], fromDate?: string, toDate: string } | null} */
let pendingConflict = null;

/** @type {string[]} */
let selectedListingIds = [];

/** Mobile: tap listing then tap day */
let mobilePickIds = [];

function setPendingConflict(payload) {
  pendingConflict = payload;
  openOverlay('tours-conflict-overlay');
}

async function runAssign(listingIds, tourDate, mode) {
  showStatus('');
  try {
    const result = await postAction({
      type: 'assign',
      listingIds,
      tourDate,
      mode,
    });
    if (result.needChoice) {
      setPendingConflict({ kind: 'assign', listingIds, toDate: tourDate });
      return;
    }
    if (result.optimizeError && !/at least 2 geocoded/i.test(result.optimizeError)) {
      showStatus(result.optimizeError, true);
    }
    reloadForDay(tourDate);
  } catch (e) {
    showStatus(e instanceof Error ? e.message : 'Assign failed', true);
  }
}

async function runMoveDay(fromDate, toDate, mode) {
  showStatus('');
  try {
    const result = await postAction({ type: 'moveDay', fromDate, toDate, mode });
    if (result.needChoice) {
      setPendingConflict({ kind: 'moveDay', fromDate, toDate });
      return;
    }
    if (result.optimizeError && !/at least 2 geocoded/i.test(result.optimizeError)) {
      showStatus(result.optimizeError, true);
    }
    reloadForDay(toDate);
  } catch (e) {
    showStatus(e instanceof Error ? e.message : 'Move failed', true);
  }
}

function cellStopCount(cell) {
  return Number(cell?.getAttribute('data-stop-count') || '0');
}

function handleDropOnDate(tourDate, payload) {
  const cell = document.querySelector(`[data-tour-date="${tourDate}"]`);
  const occupied = cellStopCount(cell) > 0;

  if (payload.kind === 'day') {
    if (payload.fromDate === tourDate) return;
    if (occupied) {
      setPendingConflict({
        kind: 'moveDay',
        fromDate: payload.fromDate,
        toDate: tourDate,
      });
      return;
    }
    void runMoveDay(payload.fromDate, tourDate, undefined);
    return;
  }

  const listingIds = payload.listingIds?.length
    ? payload.listingIds
    : selectedListingIds.length
      ? selectedListingIds
      : [];
  if (!listingIds.length) return;

  if (occupied) {
    setPendingConflict({ kind: 'assign', listingIds, toDate: tourDate });
    return;
  }
  void runAssign(listingIds, tourDate, undefined);
}

function parseDragPayload(event) {
  try {
    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function bindDragSources(root, signal) {
  root.querySelectorAll('[data-drag-kind="listing"][draggable="true"]').forEach((el) => {
    el.addEventListener(
      'dragstart',
      (event) => {
        const id = el.getAttribute('data-listing-id');
        if (!id || id.startsWith('custom-')) {
          event.preventDefault();
          return;
        }
        const ids =
          selectedListingIds.includes(id) && selectedListingIds.length > 1
            ? selectedListingIds
            : [id];
        event.dataTransfer?.setData(
          'application/json',
          JSON.stringify({ kind: 'listing', listingIds: ids }),
        );
        event.dataTransfer.effectAllowed = 'move';
        el.classList.add('is-dragging');
      },
      { signal },
    );
    el.addEventListener(
      'dragend',
      () => {
        el.classList.remove('is-dragging');
      },
      { signal },
    );
    el.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('a, button, form')) return;
        const id = el.getAttribute('data-listing-id');
        if (!id) return;
        if (event.metaKey || event.ctrlKey) {
          if (selectedListingIds.includes(id)) {
            selectedListingIds = selectedListingIds.filter((x) => x !== id);
          } else {
            selectedListingIds = [...selectedListingIds, id];
          }
        } else {
          selectedListingIds = [id];
          mobilePickIds = [id];
        }
        root.querySelectorAll('[data-listing-id].is-selected').forEach((n) => {
          n.classList.remove('is-selected');
        });
        selectedListingIds.forEach((sid) => {
          root.querySelectorAll(`[data-listing-id="${sid}"]`).forEach((n) => {
            n.classList.add('is-selected');
          });
        });
      },
      { signal },
    );
  });

  root.querySelectorAll('[data-tour-day-dot][draggable="true"]').forEach((dot) => {
    dot.addEventListener(
      'dragstart',
      (event) => {
        event.stopPropagation();
        const cell = dot.closest('[data-tour-date]');
        const fromDate = cell?.getAttribute('data-tour-date');
        if (!fromDate) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData(
          'application/json',
          JSON.stringify({ kind: 'day', fromDate }),
        );
        event.dataTransfer.effectAllowed = 'move';
      },
      { signal },
    );
  });
}

function bindDropTargets(root, signal) {
  root.querySelectorAll('[data-tour-date]').forEach((cell) => {
    cell.addEventListener(
      'dragover',
      (event) => {
        event.preventDefault();
        cell.classList.add('is-drop-target');
      },
      { signal },
    );
    cell.addEventListener(
      'dragleave',
      () => {
        cell.classList.remove('is-drop-target');
      },
      { signal },
    );
    cell.addEventListener(
      'drop',
      (event) => {
        event.preventDefault();
        cell.classList.remove('is-drop-target');
        const tourDate = cell.getAttribute('data-tour-date');
        if (!tourDate) return;
        const payload = parseDragPayload(event);
        if (!payload) return;
        handleDropOnDate(tourDate, payload);
      },
      { signal },
    );
    cell.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('[data-tour-day-dot]')) return;
        const tourDate = cell.getAttribute('data-tour-date');
        if (!tourDate) return;
        if (mobilePickIds.length) {
          const ids = [...mobilePickIds];
          mobilePickIds = [];
          handleDropOnDate(tourDate, { kind: 'listing', listingIds: ids });
          return;
        }
        reloadForDay(tourDate);
      },
      { signal },
    );
  });

  const rail = root.querySelector('[data-tours-unscheduled]');
  if (rail) {
    rail.addEventListener(
      'dragover',
      (event) => {
        event.preventDefault();
        rail.classList.add('is-drop-target');
      },
      { signal },
    );
    rail.addEventListener(
      'dragleave',
      () => {
        rail.classList.remove('is-drop-target');
      },
      { signal },
    );
    rail.addEventListener(
      'drop',
      async (event) => {
        event.preventDefault();
        rail.classList.remove('is-drop-target');
        const payload = parseDragPayload(event);
        const cfg = seed();
        if (!payload || payload.kind !== 'listing' || !cfg?.selectedTourId) return;
        try {
          await postAction({
            type: 'unassign',
            listingIds: payload.listingIds,
            tourDayId: cfg.selectedTourId,
          });
          reloadForDay(cfg.selectedDate);
        } catch (e) {
          showStatus(e instanceof Error ? e.message : 'Unassign failed', true);
        }
      },
      { signal },
    );
  }
}

let abort = null;

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

async function boot() {
  abort?.abort();
  abort = new AbortController();
  const { signal } = abort;

  const cfg = seed();
  const root = document.querySelector('[data-tours-workspace]');
  if (!cfg || !root) return;

  if (cfg.needsAutoroute && cfg.selectedTourId) {
    try {
      const res = await fetch('/api/tours/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tourDayId: cfg.selectedTourId }),
      });
      if (res.ok) {
        reloadForDay(cfg.selectedDate);
        return;
      }
      const data = await res.json().catch(() => ({}));
      showStatus(data.error || 'Could not auto-route this day', true);
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Auto-route failed', true);
    }
  }

  bindDragSources(root, signal);
  bindDropTargets(root, signal);

  root.querySelector('[data-tour-week-prev]')?.addEventListener(
    'click',
    () => weekShift(-1),
    { signal },
  );
  root.querySelector('[data-tour-week-next]')?.addEventListener(
    'click',
    () => weekShift(1),
    { signal },
  );

  const jumpBtn = root.querySelector('[data-tour-week-jump]');
  const jumpInput = root.querySelector('[data-tour-week-jump-input]');
  jumpBtn?.addEventListener(
    'click',
    () => {
      if (!(jumpInput instanceof HTMLInputElement)) return;
      if (typeof jumpInput.showPicker === 'function') {
        jumpInput.showPicker();
      } else {
        jumpInput.focus();
        jumpInput.click();
      }
    },
    { signal },
  );
  jumpInput?.addEventListener(
    'change',
    () => {
      if (!(jumpInput instanceof HTMLInputElement) || !jumpInput.value) return;
      reloadForDay(jumpInput.value);
    },
    { signal },
  );

  root.querySelector('[data-tour-week-info]')?.addEventListener(
    'click',
    () => openOverlay('tours-info-overlay'),
    { signal },
  );

  document.querySelectorAll('[data-tours-info-close]').forEach((el) => {
    el.addEventListener('click', () => closeOverlay('tours-info-overlay'), { signal });
  });

  document.querySelectorAll('[data-tours-conflict-close]').forEach((el) => {
    el.addEventListener(
      'click',
      () => {
        pendingConflict = null;
        closeOverlay('tours-conflict-overlay');
      },
      { signal },
    );
  });

  document.querySelectorAll('[data-tours-conflict-mode]').forEach((el) => {
    el.addEventListener(
      'click',
      () => {
        const mode = el.getAttribute('data-tours-conflict-mode');
        const pending = pendingConflict;
        pendingConflict = null;
        closeOverlay('tours-conflict-overlay');
        if (!pending || (mode !== 'merge' && mode !== 'replace')) return;
        if (pending.kind === 'assign') {
          void runAssign(pending.listingIds, pending.toDate, mode);
        } else {
          void runMoveDay(pending.fromDate, pending.toDate, mode);
        }
      },
      { signal },
    );
  });

  root.querySelector('[data-tours-rail-toggle]')?.addEventListener(
    'click',
    () => {
      const rail = root.querySelector('[data-tours-rail]');
      const toggle = root.querySelector('[data-tours-rail-toggle]');
      if (!rail || !toggle) return;
      const collapsed = rail.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute(
        'aria-label',
        collapsed ? 'Expand unscheduled' : 'Collapse unscheduled',
      );
      toggle.setAttribute('title', collapsed ? 'Expand' : 'Collapse');
    },
    { signal },
  );

  root.querySelectorAll('[data-tours-unassign]').forEach((btn) => {
    btn.addEventListener(
      'click',
      async () => {
        const listingId = btn.getAttribute('data-tours-unassign');
        const tourDayId = root
          .querySelector('[data-tours-stops]')
          ?.getAttribute('data-tour-day-id');
        if (!listingId || !tourDayId) return;
        try {
          await postAction({
            type: 'unassign',
            listingIds: [listingId],
            tourDayId,
          });
          reloadForDay(cfg.selectedDate);
        } catch (e) {
          showStatus(e instanceof Error ? e.message : 'Unassign failed', true);
        }
      },
      { signal },
    );
  });

  root.querySelectorAll('[data-tours-se-open]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const which = btn.getAttribute('data-tours-se-open');
        openOverlay('tours-se-overlay');
        const startField = document.querySelector('[data-tours-se-field="start"]');
        const endField = document.querySelector('[data-tours-se-field="end"]');
        if (startField) startField.hidden = which === 'end';
        if (endField) endField.hidden = which === 'start';
      },
      { signal },
    );
  });

  document.querySelectorAll('[data-tours-se-close]').forEach((el) => {
    el.addEventListener('click', () => closeOverlay('tours-se-overlay'), { signal });
  });

  mountEndpointSearch('tours-se-start-search', cfg.localeId, signal);
  mountEndpointSearch('tours-se-end-search', cfg.localeId, signal);

  const seForm = document.querySelector('[data-tours-se-form]');
  seForm?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const body = new FormData(form);
      try {
        const res = await fetch('/api/tours/endpoints', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save endpoints');
        const opt = await fetch('/api/tours/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ tourDayId: cfg.selectedTourId }),
        });
        if (!opt.ok) {
          const od = await opt.json().catch(() => ({}));
          throw new Error(od.error || 'Optimize failed');
        }
        reloadForDay(cfg.selectedDate);
      } catch (e) {
        showStatus(e instanceof Error ? e.message : 'Save failed', true);
      }
    },
    { signal },
  );

  root.querySelector('[data-tours-auto-plan]')?.addEventListener(
    'click',
    async () => {
      const hint = document.getElementById('auto-plan-hint');
      const box = document.getElementById('auto-plan-clusters');
      if (hint) {
        hint.hidden = false;
        hint.textContent = 'Clustering…';
      }
      try {
        const res = await fetch('/api/tours/auto-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ localeId: cfg.localeId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Auto-plan failed');
        if (hint) {
          hint.textContent = `Clusters within ${data.radiusMiles} mi (max ${data.maxPerCluster}). Drag a cluster onto a date.`;
        }
        if (!box) return;
        box.hidden = false;
        box.replaceChildren();
        for (const cluster of data.clusters ?? []) {
          const card = document.createElement('div');
          card.className = 'tours-workspace__cluster';
          card.draggable = true;
          card.dataset.dragKind = 'listing';
          card.dataset.listingIds = JSON.stringify(cluster.listingIds);
          card.innerHTML = `<strong>Cluster ${cluster.index + 1}</strong><span class="muted">${(cluster.labels || []).join(', ')}</span>`;
          card.addEventListener('dragstart', (event) => {
            event.dataTransfer?.setData(
              'application/json',
              JSON.stringify({ kind: 'listing', listingIds: cluster.listingIds }),
            );
            event.dataTransfer.effectAllowed = 'move';
          });
          box.appendChild(card);
        }
      } catch (e) {
        if (hint) hint.textContent = e instanceof Error ? e.message : 'Auto-plan failed';
      }
    },
    { signal },
  );
}

document.addEventListener('astro:page-load', () => {
  void boot();
});
