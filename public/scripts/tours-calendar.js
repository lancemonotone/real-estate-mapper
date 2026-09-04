/**
 * Locale Tours calendar workspace: select week days, drag assign, conflict overlay, S/E.
 */
import { mountPlaceSearch } from './place-search.js';
import { bindTourWeekJumpPopover } from './tour-week-jump-popover.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AUTO_PLAN_RANGE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function autoPlanFavoritesOnly(root) {
  const el = root.querySelector('[data-auto-plan-favorites-only]');
  return el instanceof HTMLInputElement && el.checked;
}

function autoPlanRangeCookieName(localeId) {
  return `wayhome_ap_range_${localeId}`;
}

function writeAutoPlanRangeCookie(localeId, startDate, endDate) {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) return;
  const name = encodeURIComponent(autoPlanRangeCookieName(localeId));
  const value = encodeURIComponent(`${startDate}_${endDate}`);
  document.cookie = `${name}=${value}; Path=/; Max-Age=${AUTO_PLAN_RANGE_MAX_AGE_SEC}; SameSite=Lax`;
}

function bindAutoPlanRangePersistence(root, localeId, signal) {
  const startEl = root.querySelector('[data-auto-plan-start]');
  const endEl = root.querySelector('[data-auto-plan-end]');
  if (!(startEl instanceof HTMLInputElement) || !(endEl instanceof HTMLInputElement)) return;

  const persist = () => {
    const startDate = startEl.value.trim();
    const endDate = endEl.value.trim();
    writeAutoPlanRangeCookie(localeId, startDate, endDate);
  };

  startEl.addEventListener('change', persist, { signal });
  endEl.addEventListener('change', persist, { signal });
}

function applyTourDayRoute(payload) {
  if (!payload) return;

  const mapEl = document.getElementById('tour-map');
  if (mapEl instanceof HTMLElement) {
    mapEl.dataset.stops = JSON.stringify(payload.mapStops ?? []);
    mapEl.dataset.polyline = payload.encodedPolyline ?? '';
    mapEl.dataset.rev = [
      payload.encodedPolyline ?? '',
      ...(payload.mapStops ?? []).map((stop) => stop.id),
    ].join('|');
    mapEl.dataset.customStart = payload.customStart
      ? JSON.stringify(payload.customStart)
      : '';
    mapEl.dataset.customEnd = payload.customEnd ? JSON.stringify(payload.customEnd) : '';
    document.dispatchEvent(new CustomEvent('wayhome:tour-map-refresh'));
  }

  const list = document.querySelector('[data-tours-stops]');
  const orderedIds = payload.orderedListingIds ?? [];
  if (list instanceof HTMLElement && orderedIds.length) {
    const customEnd = list.querySelector('[data-listing-id="custom-end"]');
    for (const listingId of orderedIds) {
      const item = list.querySelector(`li[data-listing-id="${listingId}"]`);
      if (item instanceof HTMLElement) {
        list.insertBefore(item, customEnd);
      }
    }
    for (const stop of payload.mapStops ?? []) {
      const item = list.querySelector(`li[data-listing-id="${stop.id}"]`);
      const badge = item?.querySelector('.tour-stop-badge');
      if (badge && stop.glyph) badge.textContent = stop.glyph;
    }
  }

  const cfg = seed();
  if (cfg) cfg.needsAutoroute = false;
}

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
  el.classList.toggle('is-plan-limit', Boolean(message) && isError);
}

function dropHintEl() {
  return document.getElementById('tours-drop-hint');
}

function showDropHint(message, cell) {
  const hint = dropHintEl();
  const text = hint?.querySelector('[data-tours-drop-hint-text]');
  if (!(hint instanceof HTMLElement) || !(text instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
    return;
  }
  text.textContent = message;
  hint.hidden = false;
  hint.classList.add('is-visible');
  const rect = cell.getBoundingClientRect();
  hint.style.left = `${rect.left + rect.width / 2}px`;
  hint.style.top = `${rect.bottom + 8}px`;
  hint.style.transform = 'translateX(-50%) translateY(0)';
}

function hideDropHint() {
  const hint = dropHintEl();
  if (!(hint instanceof HTMLElement)) return;
  hint.hidden = true;
  hint.classList.remove('is-visible');
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
  url.searchParams.delete('_r');

  const cur = new URL(window.location.href);
  const samePath = cur.pathname === url.pathname;
  const sameDay = (cur.searchParams.get('day') || '') === (url.searchParams.get('day') || '');
  if (samePath && sameDay) {
    window.location.reload();
    return;
  }
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

/** Last plain-click listing id for Shift-range within the day list */
let selectionAnchorId = null;

/** Mobile: tap listing then tap day */
let mobilePickIds = [];

function dayListingIds(root) {
  const list = root.querySelector('[data-tours-stops]');
  if (!(list instanceof HTMLElement)) return [];
  return [...list.querySelectorAll('[data-drag-kind="listing"][data-listing-id]')]
    .map((el) => el.getAttribute('data-listing-id'))
    .filter((id) => id && !id.startsWith('custom-'));
}

function paintSelection(root) {
  root.querySelectorAll('[data-drag-kind="listing"].is-selected').forEach((n) => {
    n.classList.remove('is-selected');
  });
  selectedListingIds.forEach((sid) => {
    root
      .querySelectorAll(`[data-drag-kind="listing"][data-listing-id="${sid}"]`)
      .forEach((n) => {
        n.classList.add('is-selected');
      });
  });
  const removeBtn = root.querySelector('[data-tours-remove-selected]');
  if (removeBtn instanceof HTMLButtonElement) {
    removeBtn.disabled = selectedListingIds.length === 0;
  }
}

function toastClearUntimed(result) {
  const cleared = Number(result?.clearedCount ?? 0);
  const kept = Number(result?.keptTimedCount ?? 0);
  if (cleared === 0) {
    showStatus('No untimed stops to clear.', false);
    return;
  }
  if (kept > 0) {
    showStatus(
      `Cleared ${cleared} untimed stop${cleared === 1 ? '' : 's'}. ${kept} timed left on this day.`,
      false,
    );
    return;
  }
  showStatus(`Cleared ${cleared} stop${cleared === 1 ? '' : 's'}.`, false);
}

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
    if (result.tourDayId) {
      sessionStorage.removeItem(`wayhome:tours-ar:${result.tourDayId}`);
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
    if (result.tourDayId) {
      sessionStorage.removeItem(`wayhome:tours-ar:${result.tourDayId}`);
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

function resolveDropForDate(tourDate) {
  const cfg = seed()?.tourCalendar;
  if (!cfg) {
    const cell = document.querySelector(`[data-tour-date="${tourDate}"]`);
    return cellStopCount(cell) > 0
      ? { ok: true, action: 'merge' }
      : { ok: true, action: 'assign-new' };
  }

  const blocked = cfg.dropBlockedByDate?.[tourDate];
  if (blocked) {
    return { ok: false, message: blocked.message };
  }

  const meta = cfg.allDaysByDate?.[tourDate];
  const stopCount = meta?.stopCount ?? 0;
  if (stopCount > 0) {
    if (!meta.visible) {
      return { ok: false, message: cfg.hiddenMessage };
    }
    return { ok: true, action: 'merge' };
  }

  if (!cfg.canAddNewTourDay) {
    return { ok: false, message: cfg.capMessage };
  }

  return { ok: true, action: 'assign-new' };
}

function handleDropOnDate(tourDate, payload) {
  const decision = resolveDropForDate(tourDate);
  if (!decision.ok) {
    showStatus(decision.message, true);
    return;
  }

  if (payload.kind === 'day') {
    if (payload.fromDate === tourDate) return;
    if (decision.action === 'merge') {
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

  if (decision.action === 'merge') {
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
        if (!id || id.startsWith('custom-')) return;

        const inDayList = Boolean(el.closest('[data-tours-stops]'));
        if (event.shiftKey && inDayList && selectionAnchorId) {
          const ids = dayListingIds(root);
          const a = ids.indexOf(selectionAnchorId);
          const b = ids.indexOf(id);
          if (a >= 0 && b >= 0) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            selectedListingIds = ids.slice(lo, hi + 1);
          } else {
            selectedListingIds = [id];
            selectionAnchorId = id;
          }
        } else if (event.metaKey || event.ctrlKey) {
          if (selectedListingIds.includes(id)) {
            selectedListingIds = selectedListingIds.filter((x) => x !== id);
          } else {
            selectedListingIds = [...selectedListingIds, id];
          }
          selectionAnchorId = id;
        } else {
          selectedListingIds = [id];
          selectionAnchorId = id;
          mobilePickIds = [id];
        }
        paintSelection(root);
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
        const tourDate = cell.getAttribute('data-tour-date');
        if (!tourDate) return;
        const decision = resolveDropForDate(tourDate);
        cell.classList.remove('is-drop-target', 'is-drop-forbidden');
        if (!decision.ok) {
          cell.classList.add('is-drop-forbidden');
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
          showDropHint(decision.message, cell);
          return;
        }
        hideDropHint();
        cell.classList.add('is-drop-target');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      },
      { signal },
    );
    cell.addEventListener(
      'dragleave',
      () => {
        cell.classList.remove('is-drop-target', 'is-drop-forbidden');
        hideDropHint();
      },
      { signal },
    );
    cell.addEventListener(
      'drop',
      (event) => {
        event.preventDefault();
        cell.classList.remove('is-drop-target', 'is-drop-forbidden');
        hideDropHint();
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

  const rail = root.querySelector('[data-tours-rail]');
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
      (event) => {
        if (event.relatedTarget instanceof Node && rail.contains(event.relatedTarget)) {
          return;
        }
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
        if (!payload || !cfg) return;

        if (payload.kind === 'day' && payload.fromDate) {
          try {
            const result = await postAction({
              type: 'clearUntimed',
              tourDate: payload.fromDate,
            });
            toastClearUntimed(result);
            let nextDay = cfg.selectedDate;
            if (!result.tourDayId) {
              if (cfg.selectedDate === payload.fromDate) nextDay = null;
            } else if (!cfg.selectedDate || cfg.selectedDate === payload.fromDate) {
              nextDay = payload.fromDate;
            }
            reloadForDay(nextDay);
          } catch (e) {
            showStatus(e instanceof Error ? e.message : 'Clear day failed', true);
          }
          return;
        }

        if (payload.kind !== 'listing' || !cfg.selectedTourId) return;
        try {
          const ids = payload.listingIds ?? [];
          await postAction({
            type: 'unassign',
            listingIds: ids,
            tourDayId: cfg.selectedTourId,
          });
          if (ids.length > 0) {
            showStatus(
              `Removed ${ids.length} stop${ids.length === 1 ? '' : 's'} from this day.`,
              false,
            );
          }
          selectedListingIds = [];
          selectionAnchorId = null;
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

function bindDaySelectionToolbar(root, signal) {
  root.querySelector('[data-tours-select-all]')?.addEventListener(
    'click',
    () => {
      selectedListingIds = dayListingIds(root);
      selectionAnchorId = selectedListingIds[0] ?? null;
      paintSelection(root);
    },
    { signal },
  );

  root.querySelector('[data-tours-clear-selection]')?.addEventListener(
    'click',
    () => {
      selectedListingIds = [];
      selectionAnchorId = null;
      mobilePickIds = [];
      paintSelection(root);
    },
    { signal },
  );

  root.querySelector('[data-tours-remove-selected]')?.addEventListener(
    'click',
    async () => {
      const cfg = seed();
      const tourDayId = root
        .querySelector('[data-tours-stops]')
        ?.getAttribute('data-tour-day-id');
      const ids = [...selectedListingIds];
      if (!cfg || !tourDayId || ids.length === 0) return;
      try {
        await postAction({
          type: 'unassign',
          listingIds: ids,
          tourDayId,
        });
        showStatus(
          `Removed ${ids.length} stop${ids.length === 1 ? '' : 's'} from this day.`,
          false,
        );
        selectedListingIds = [];
        selectionAnchorId = null;
        reloadForDay(cfg.selectedDate);
      } catch (e) {
        showStatus(e instanceof Error ? e.message : 'Unassign failed', true);
      }
    },
    { signal },
  );
}

async function boot() {
  abort?.abort();
  abort = new AbortController();
  const { signal } = abort;

  const cfg = seed();
  const root = document.querySelector('[data-tours-workspace]');
  if (!cfg || !root) return;

  const dropHint = dropHintEl();
  if (dropHint instanceof HTMLElement && dropHint.parentElement !== document.body) {
    document.body.appendChild(dropHint);
  }
  document.addEventListener('dragend', hideDropHint, { signal });

  if (cfg.needsAutoroute && cfg.selectedTourId) {
    // v2: prior guard was set before optimize succeeded, leaving days stuck when
    // route_signature mismatched the stop set.
    const arKey = `wayhome:tours-ar:v2:${cfg.selectedTourId}`;
    const stopSig = cfg.routeStopSignature ?? '';
    if (sessionStorage.getItem(arKey) === stopSig) {
      showStatus('Could not build a route for this day', true);
    } else {
      try {
        const res = await fetch('/api/tours/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ tourDayId: cfg.selectedTourId }),
        });
        if (res.ok) {
          sessionStorage.removeItem(arKey);
          const data = await res.json().catch(() => ({}));
          applyTourDayRoute(data.map);
          showStatus('Route updated', false);
          return;
        }
        sessionStorage.setItem(arKey, stopSig);
        const data = await res.json().catch(() => ({}));
        showStatus(data.error || 'Could not auto-route this day', true);
      } catch (e) {
        sessionStorage.setItem(arKey, stopSig);
        showStatus(e instanceof Error ? e.message : 'Auto-route failed', true);
      }
    }
  }

  bindDragSources(root, signal);
  bindDropTargets(root, signal);
  bindAutoPlanRangePersistence(root, cfg.localeId, signal);
  bindDaySelectionToolbar(root, signal);
  paintSelection(root);

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

  const jumpInput = root.querySelector('[data-tour-week-jump-input]');
  const weekRoot = root.querySelector('[data-tour-week]');
  if (weekRoot) {
    bindTourWeekJumpPopover(weekRoot, {
      signal,
      onSelectDate: (day) => reloadForDay(day),
    });
  }
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

  root.querySelectorAll('[data-appointment-time]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener('mousedown', (e) => e.stopPropagation(), { signal });
    input.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
    input.addEventListener(
      'change',
      async () => {
        const listingId = input.getAttribute('data-listing-id');
        const tourDayId = root
          .querySelector('[data-tours-stops]')
          ?.getAttribute('data-tour-day-id');
        if (!listingId || !tourDayId) return;
        const appointment_time = input.value.trim() || null;
        try {
          const res = await fetch('/api/tours/appointment-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              tour_day_id: tourDayId,
              listing_id: listingId,
              appointment_time,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Could not save time');
          if (data.optimizeError) {
            showStatus(data.optimizeError, true);
          }
          reloadForDay(cfg.selectedDate);
        } catch (e) {
          showStatus(e instanceof Error ? e.message : 'Could not save time', true);
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
        const optData = await opt.json().catch(() => ({}));
        if (!opt.ok) {
          throw new Error(optData.error || 'Optimize failed');
        }
        applyTourDayRoute(optData.map);
        closeOverlay('tours-se-overlay');
        showStatus('Route updated', false);
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
      const applyBtn = root.querySelector('[data-tours-auto-plan-apply]');
      const startEl = root.querySelector('[data-auto-plan-start]');
      const endEl = root.querySelector('[data-auto-plan-end]');
      const startDate =
        startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
      const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
      if (!startDate || !endDate) {
        if (hint) {
          hint.hidden = false;
          hint.textContent = 'Choose a From and To date.';
        }
        return;
      }
      writeAutoPlanRangeCookie(cfg.localeId, startDate, endDate);
      if (applyBtn instanceof HTMLButtonElement) applyBtn.hidden = true;
      if (hint) {
        hint.hidden = false;
        hint.textContent = 'Planning…';
      }
      try {
        const res = await fetch('/api/tours/auto-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            localeId: cfg.localeId,
            startDate,
            endDate,
            favoritesOnly: autoPlanFavoritesOnly(root),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Auto-plan failed');
        if (!box) return;
        box.hidden = false;
        box.replaceChildren();

        const assignedCount = (data.assignments ?? []).reduce(
          (n, a) => n + (a.listingIds?.length ?? 0),
          0,
        );
        const overflowCount = (data.overflowIds ?? []).length;
        if (hint) {
          const parts = [
            `Preview: ${assignedCount} listing${assignedCount === 1 ? '' : 's'} into ${startDate} → ${endDate}`,
            `(${data.radiusMiles} mi · max ${data.maxPerDay}/day)`,
          ];
          if (data.favoritesOnly) {
            parts.push('favorites only');
          }
          if (data.skippedMissingGeo > 0) {
            parts.push(`${data.skippedMissingGeo} missing location skipped`);
          }
          if (data.skippedNotFavorite > 0) {
            parts.push(`${data.skippedNotFavorite} not favorited skipped`);
          }
          if (overflowCount > 0) {
            parts.push(`${overflowCount} left unscheduled`);
          }
          if (assignedCount === 0 && data.favoritesOnly && data.unscheduledGeocoded === 0) {
            hint.textContent =
              'No favorited unscheduled geocoded listings to place.';
          } else {
            hint.textContent = parts.join(' · ');
          }
        }

        for (const group of data.assignments ?? []) {
          const card = document.createElement('div');
          card.className = 'tours-workspace__cluster';
          const verb = group.merge ? 'Merge' : 'New day';
          card.innerHTML = `<strong>${verb} · ${group.tourDate}</strong><span class="muted">${(group.labels || []).join(', ')}</span>`;
          box.appendChild(card);
        }

        if (overflowCount > 0) {
          const card = document.createElement('div');
          card.className = 'tours-workspace__cluster tours-workspace__cluster--overflow';
          card.innerHTML = `<strong>Unscheduled overflow</strong><span class="muted">${(data.overflowLabels || []).join(', ')}</span>`;
          box.appendChild(card);
        }

        if (applyBtn instanceof HTMLButtonElement) {
          applyBtn.hidden = assignedCount === 0;
        }
      } catch (e) {
        if (hint) hint.textContent = e instanceof Error ? e.message : 'Auto-plan failed';
        if (box) {
          box.hidden = true;
          box.replaceChildren();
        }
      }
    },
    { signal },
  );

  root.querySelector('[data-tours-auto-plan-apply]')?.addEventListener(
    'click',
    async () => {
      const hint = document.getElementById('auto-plan-hint');
      const applyBtn = root.querySelector('[data-tours-auto-plan-apply]');
      const startEl = root.querySelector('[data-auto-plan-start]');
      const endEl = root.querySelector('[data-auto-plan-end]');
      const startDate =
        startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
      const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
      if (!startDate || !endDate) return;
      writeAutoPlanRangeCookie(cfg.localeId, startDate, endDate);
      if (applyBtn instanceof HTMLButtonElement) applyBtn.disabled = true;
      if (hint) {
        hint.hidden = false;
        hint.textContent = 'Applying…';
      }
      try {
        const res = await fetch('/api/tours/auto-plan-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            localeId: cfg.localeId,
            startDate,
            endDate,
            favoritesOnly: autoPlanFavoritesOnly(root),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Apply failed');
        const optFail = (data.optimized ?? []).filter((o) => !o.ok);
        if (optFail.length > 0) {
          showStatus(
            optFail.map((o) => o.error || 'Optimize failed').join('; '),
            true,
          );
        } else if (data.message) {
          showStatus(data.message, false);
        }
        reloadForDay(cfg.selectedDate || startDate);
      } catch (e) {
        if (hint) hint.textContent = e instanceof Error ? e.message : 'Apply failed';
        if (applyBtn instanceof HTMLButtonElement) applyBtn.disabled = false;
      }
    },
    { signal },
  );
}

document.addEventListener('astro:page-load', () => {
  void boot();
});
