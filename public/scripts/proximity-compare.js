import { mountPlaceSearch } from './place-search.js';
import {
  isPlanLimitResponse,
  patchRouteSearchRefreshBudget,
  proxResultStatusClass,
  readRouteSearchPlanConfig,
  criterionStatusClass,
  syncRouteSearchRefreshUi,
} from './plan-limit.js';
import {
  mountAllPlaceTypePickers,
  readPlaceTypeValue,
  setPlaceTypeValue,
} from './place-type-picker.js';
import { iconBan, iconBtn, iconMapPin, iconPencil, iconRoute } from './ui-icons.js';
import { loadGoogleMapsJs } from './google-maps-loader.js';

function formatDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '';
  const minutes = Math.round(sec / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatMiles(meters) {
  if (meters == null || !Number.isFinite(meters)) return '';
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function formatMeta(durationSec, distanceM) {
  return [formatDuration(durationSec), formatMiles(distanceM)].filter(Boolean).join(' · ');
}

function normalizePlaceId(placeId) {
  if (!placeId) return null;
  return String(placeId).startsWith('places/')
    ? String(placeId).slice('places/'.length)
    : String(placeId);
}

const TRAVELMODE = {
  DRIVE: 'driving',
  WALK: 'walking',
  BICYCLE: 'bicycling',
  TRANSIT: 'transit',
};

const JS_TRAVEL = {
  DRIVE: 'DRIVING',
  WALK: 'WALKING',
  BICYCLE: 'BICYCLING',
  TRANSIT: 'TRANSIT',
};

function directionsUrl(td, result) {
  const originLat = Number(td.dataset.listingLat);
  const originLng = Number(td.dataset.listingLng);
  const mode = td.dataset.travelMode || 'DRIVE';
  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    result.place_lat == null ||
    result.place_lng == null
  ) {
    return result.maps_url || null;
  }

  const params = new URLSearchParams({
    api: '1',
    origin: `${originLat},${originLng}`,
    travelmode: TRAVELMODE[mode] || 'driving',
  });
  const placeId = normalizePlaceId(result.place_id);
  if (placeId) {
    params.set(
      'destination',
      result.place_name || `${result.place_lat},${result.place_lng}`,
    );
    params.set('destination_place_id', placeId);
  } else {
    params.set('destination', `${result.place_lat},${result.place_lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function openCellRoute(td, result, href) {
  const originLat = Number(td.dataset.listingLat);
  const originLng = Number(td.dataset.listingLng);
  const maps = window.__WAYHOME_MAPS__ || {};
  const listingName =
    td.closest('tr')?.querySelector('.matrix-listing__name')?.textContent?.trim() ||
    td.closest('tr')?.querySelector('th')?.textContent?.trim() ||
    'Listing';
  const durationLabel = formatMeta(result.duration_sec, result.distance_m);
  window.openDirectionsOverlay?.({
    origin: { lat: originLat, lng: originLng },
    destination: {
      lat: result.place_lat,
      lng: result.place_lng,
      placeId: result.place_id,
      name: result.place_name,
    },
    travelMode: td.dataset.travelMode || 'DRIVE',
    title: `${listingName} → ${result.place_name || 'Place'}`,
    durationLabel,
    externalUrl: href,
    mapKey: maps.mapKey,
    mapId: maps.mapId,
  });
}

function columnLabelForTd(td) {
  const criterionId = td.dataset.criterionId;
  if (!criterionId) return 'Travel column';
  const th = document.querySelector(
    `#compare-table thead th[data-criterion-id="${criterionId}"] .matrix-criterion-head__label`,
  );
  return th?.textContent?.trim() || 'Travel column';
}

function placeTypeKeyForTd(td) {
  const criterionId = td.dataset.criterionId;
  if (!criterionId) return '';
  const th = document.querySelector(
    `#compare-table thead th[data-criterion-id="${criterionId}"]`,
  );
  return th instanceof HTMLElement ? th.dataset.placeTypeKey || '' : '';
}

function localeIdFromPage() {
  return (
    window.__WAYHOME_COMPARE__?.localeId ||
    window.__WAYHOME_LOCALE_ID__ ||
    ''
  );
}

function applyExcludeResults(results) {
  if (!Array.isArray(results)) return;
  for (const result of results) {
    if (!result?.listing_id || !result?.criterion_id) continue;
    const td = document.querySelector(
      `td[data-listing-id="${result.listing_id}"][data-criterion-id="${result.criterion_id}"]`,
    );
    if (td) renderCell(td, result);
  }
}

function initRefreshStaleButton(signal) {
  const btn = document.querySelector('[data-compare-refresh-stale]');
  if (!(btn instanceof HTMLButtonElement)) return;

  btn.addEventListener(
    'click',
    async () => {
      const plan = readRouteSearchPlanConfig(window.__WAYHOME_COMPARE__);
      if (plan && !plan.canRefresh) return;

      const localeId = localeIdFromPage();
      if (!localeId) return;

      const prevLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Refreshing…';

      try {
        const res = await fetch('/api/proximity/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale_id: localeId, refresh_stale: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || `HTTP ${res.status}`);
          return;
        }

        applyExcludeResults(data.results);

        if (typeof data.refresh_remaining === 'number') {
          const nextPlan = patchRouteSearchRefreshBudget(
            window.__WAYHOME_COMPARE__,
            data.refresh_remaining,
          );
          if (nextPlan && window.__WAYHOME_COMPARE__?.routeSearchPlan) {
            Object.assign(window.__WAYHOME_COMPARE__.routeSearchPlan, nextPlan);
            syncRouteSearchRefreshUi(nextPlan);
          }
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Refresh failed');
      } finally {
        btn.textContent = prevLabel;
        const current = readRouteSearchPlanConfig(window.__WAYHOME_COMPARE__);
        btn.disabled = Boolean(current && !current.canRefresh);
      }
    },
    { signal },
  );
}

async function excludePlaceFromCell(td, result) {
  const localeId = localeIdFromPage();
  const placeTypeKey = placeTypeKeyForTd(td);
  const placeId = result?.place_id;
  if (!localeId || !placeTypeKey || !placeId) return;

  const name = result.place_name || 'this place';
  const ok = window.confirm(
    `Exclude “${name}” for all nearest ${placeTypeKey} columns? Unlocked listings (and this cell) will pick the next closest match. Other locked cells stay as they are.`,
  );
  if (!ok) return;

  renderCell(td, null);
  try {
    const res = await fetch('/api/proximity/exclude-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale_id: localeId,
        place_type_key: placeTypeKey,
        place_id: placeId,
        listing_id: td.dataset.listingId,
        criterion_id: td.dataset.criterionId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Could not exclude place');
      renderCell(td, result);
      return;
    }
    applyExcludeResults(data.results);
    const listingId = td.dataset.listingId;
    const criterionId = td.dataset.criterionId;
    const updated = Array.isArray(data.results)
      ? data.results.find(
          (r) => r.listing_id === listingId && r.criterion_id === criterionId,
        )
      : null;
    if (!updated) {
      await computeCell(td);
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Could not exclude place');
    renderCell(td, result);
  }
}

function setCellSortValue(td, result) {
  if (result?.status === 'ok' && result.duration_sec != null) {
    td.setAttribute('data-sort-value', String(result.duration_sec));
  } else {
    td.removeAttribute('data-sort-value');
  }
}

function renderCell(td, result) {
  td.replaceChildren();
  setCellSortValue(td, result);
  if (!result) {
    const pending = document.createElement('span');
    pending.className = 'cell-pending';
    pending.textContent = 'Computing…';
    td.appendChild(pending);
    return;
  }

  if (result.status === 'ok') {
    const wrap = document.createElement('div');
    wrap.className = 'cell-ok';
    const place = document.createElement('div');
    place.className = 'cell-ok__place';
    if (result.place_name) {
      const name = document.createElement('div');
      name.className = 'cell-ok__name';
      name.textContent = result.place_name;
      place.appendChild(name);
    }
    const meta = document.createElement('div');
    meta.className = 'cell-ok__meta';
    meta.textContent = formatMeta(result.duration_sec, result.distance_m);
    if (meta.textContent) place.appendChild(meta);
    if (place.childNodes.length) wrap.appendChild(place);

    const href = directionsUrl(td, result);
    const originLat = Number(td.dataset.listingLat);
    const originLng = Number(td.dataset.listingLng);
    const canOverlay =
      Number.isFinite(originLat) &&
      Number.isFinite(originLng) &&
      result.place_lat != null &&
      result.place_lng != null;

    const actions = document.createElement('div');
    actions.className = 'cell-actions';

    actions.appendChild(
      iconBtn({
        label: `Change location for ${columnLabelForTd(td)}`,
        icon: iconPencil,
        onClick: () => openCellPlacePicker(td, result),
      }),
    );

    if (placeTypeKeyForTd(td) && result.place_id) {
      actions.appendChild(
        iconBtn({
          label: `Exclude ${result.place_name || 'this place'} for this place type`,
          icon: iconBan,
          onClick: () => void excludePlaceFromCell(td, result),
        }),
      );
    }

    if (canOverlay) {
      actions.appendChild(
        iconBtn({
          label: 'Show the route on a map overlay',
          icon: iconRoute,
          onClick: () => openCellRoute(td, result, href),
        }),
      );
    }

    if (href) {
      actions.appendChild(
        iconBtn({
          label: 'Open turn-by-turn directions in Google Maps',
          icon: iconMapPin,
          href,
        }),
      );
    }

    wrap.appendChild(actions);
    td.appendChild(wrap);
    td.dataset.status = 'ok';
    return;
  }

  const status = document.createElement('div');
  status.className = 'cell-status';
  status.textContent = result.status;
  td.appendChild(status);
  if (result.error_message) {
    const err = document.createElement('div');
    err.className = result.plan_limit
      ? 'cell-status is-plan-limit'
      : 'cell-status';
    err.textContent = result.error_message;
    td.appendChild(err);
  }

  const actions = document.createElement('div');
  actions.className = 'cell-actions';
  actions.appendChild(
    iconBtn({
      label: `Change location for ${columnLabelForTd(td)}`,
      icon: iconPencil,
      onClick: () => openCellPlacePicker(td, result),
    }),
  );
  td.appendChild(actions);
  td.dataset.status = result.status;
}

async function computeCell(td) {
  const listingId = td.dataset.listingId;
  const criterionId = td.dataset.criterionId;
  if (!listingId || !criterionId) return;

  renderCell(td, null);
  try {
    const res = await fetch('/api/proximity/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, criterion_id: criterionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      renderCell(td, {
        status: 'error',
        error_message: data.error || `HTTP ${res.status}`,
        plan_limit: isPlanLimitResponse(res, data),
      });
      return;
    }
    renderCell(td, data.result);
  } catch (e) {
    renderCell(td, {
      status: 'error',
      error_message: e instanceof Error ? e.message : 'Compute failed',
    });
  }
}

function initKindToggle(signal) {
  const kind = document.getElementById('criterion-kind');
  const nearestFields = document.getElementById('nearest-fields');
  const pinFields = document.getElementById('pin-fields');
  if (!(kind instanceof HTMLSelectElement) || !nearestFields || !pinFields) {
    return;
  }

  const sync = () => {
    const isPin = kind.value === 'fixed_pin';
    nearestFields.hidden = isPin;
    pinFields.hidden = !isPin;
  };
  kind.addEventListener('change', sync, { signal });
  sync();
}

function initNearestMutualExclusive(typeEl, phraseEl, signal) {
  if (!(phraseEl instanceof HTMLInputElement)) return;

  const clearType = () => {
    if (typeEl instanceof HTMLInputElement) setPlaceTypeValue(typeEl, '');
  };

  phraseEl.addEventListener(
    'input',
    () => {
      if (phraseEl.value.trim()) clearType();
    },
    { signal },
  );

  if (typeEl instanceof HTMLInputElement) {
    typeEl.addEventListener(
      'change',
      () => {
        if (typeEl.value) phraseEl.value = '';
      },
      { signal },
    );
  }
}

function initCompareColumnOverlay(signal) {
  const overlay = document.getElementById('compare-column-overlay');
  if (!(overlay instanceof HTMLElement)) return;

  const open = () => {
    const plan = readRouteSearchPlanConfig(window.__WAYHOME_COMPARE__);
    if (plan && !plan.canAddColumn) return;
    if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    document.body.classList.add('compare-column-overlay-open');
    const first = overlay.querySelector('input[name="label"]');
    if (first instanceof HTMLElement) first.focus();
  };

  const close = () => {
    overlay.hidden = true;
    document.body.classList.remove('compare-column-overlay-open');
  };

  document.querySelectorAll('[data-compare-column-open]').forEach((el) => {
    el.addEventListener('click', open, { signal });
  });
  overlay.querySelectorAll('[data-compare-column-close]').forEach((el) => {
    el.addEventListener('click', close, { signal });
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || overlay.hidden) return;
      if (!document.getElementById('compare-place-overlay')?.hidden) return;
      close();
    },
    { signal },
  );
}

function initCriterionForm(signal) {
  const form = document.getElementById('criterion-form');
  const status = document.getElementById('criterion-status');
  const searchRoot = document.getElementById('compare-place-search');
  if (!(form instanceof HTMLFormElement)) return;

  let placeSearch = null;
  if (searchRoot && window.__WAYHOME_LOCALE_ID__) {
    placeSearch = mountPlaceSearch(searchRoot, {
      localeId: window.__WAYHOME_LOCALE_ID__,
    });
  }

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const plan = readRouteSearchPlanConfig(window.__WAYHOME_COMPARE__);
      if (plan && !plan.canAddColumn) {
        if (status) {
          status.className = criterionStatusClass({ planLimit: true });
          status.textContent = plan.addColumnBlockedMessage;
        }
        return;
      }
      const fd = new FormData(form);
      const uiKind = String(fd.get('kind') || '');
      const body = {
        locale_id: String(fd.get('locale_id') || ''),
        label: String(fd.get('label') || '').trim(),
        travel_mode: String(fd.get('travel_mode') || 'DRIVE'),
      };
      if (uiKind === 'nearest') {
        const text_query = String(fd.get('text_query') || '').trim();
        const place_type_key = String(fd.get('place_type_key') || '').trim();
        if (text_query) {
          body.kind = 'text_query';
          body.text_query = text_query;
          if (!body.label) body.label = text_query;
        } else if (place_type_key) {
          body.kind = 'place_type';
          body.place_type_key = place_type_key;
        } else {
          if (status) {
            status.textContent = 'Choose a place type or enter a search phrase';
          }
          return;
        }
      } else {
        body.kind = 'fixed_pin';
        const place = placeSearch?.getResolved?.();
        if (!place) {
          if (status) status.textContent = 'Choose a shared place from search first';
          return;
        }
        body.pin_lat = place.lat;
        body.pin_lng = place.lng;
        body.pin_place_id = place.placeId;
        body.pin_name = place.name;
        if (!body.label) body.label = place.name;
      }

      if (status) status.textContent = 'Saving…';
      const res = await fetch('/api/proximity/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (status) {
          status.className = criterionStatusClass({
            planLimit: isPlanLimitResponse(res, data),
          });
          status.textContent = data.error || 'Failed to add column';
        }
        return;
      }
      location.reload();
    },
    { signal },
  );
}

function initDeleteButtons(signal) {
  document.querySelectorAll('.delete-criterion').forEach((btn) => {
    btn.addEventListener(
      'click',
      async () => {
        const id = btn.getAttribute('data-criterion-id');
        if (!id) return;
        if (!confirm('Delete this travel column?')) return;
        const res = await fetch(`/api/proximity/criteria?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Delete failed');
          return;
        }
        location.reload();
      },
      { signal },
    );
  });
}

/* ——— Cell place picker (change nearest / search) ——— */

let cellPickerTd = null;
let cellPickerLastResult = null;
let cellPickerTravelMode = 'DRIVE';
let cellPickerPlaceSearch = null;
let cellPickerMap = null;
let cellPickerDirectionsRenderer = null;
let cellPickerDirectionsService = null;
function cellPickerCfg() {
  return window.__WAYHOME_COMPARE__ || window.__WAYHOME_MAPS__ || {};
}

function cellPickerOrigin() {
  if (!cellPickerTd) return null;
  const lat = Number(cellPickerTd.dataset.listingLat);
  const lng = Number(cellPickerTd.dataset.listingLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function setCompareProxStatus(message, { error = false, planLimit = false } = {}) {
  const el = document.getElementById('compare-prox-result');
  if (!el) return;
  el.replaceChildren();
  if (!message) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const status = document.createElement('p');
  status.className = proxResultStatusClass({ error, planLimit });
  status.textContent = message;
  el.appendChild(status);
}

function renderCompareProxResult(result) {
  const el = document.getElementById('compare-prox-result');
  if (!el) return;
  el.replaceChildren();
  if (!result) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (result.status !== 'ok') {
    const status = document.createElement('p');
    status.className = proxResultStatusClass({
      error: true,
      planLimit: Boolean(result.plan_limit),
    });
    status.textContent = [result.status, result.error_message].filter(Boolean).join('. ');
    el.appendChild(status);
    return;
  }
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  if (candidates.length > 1) {
    el.hidden = true;
    return;
  }
  if (result.place_name) {
    const name = document.createElement('p');
    name.className = 'prox-result__name';
    name.textContent = result.place_name;
    el.appendChild(name);
  }
  const metaText = formatMeta(result.duration_sec, result.distance_m);
  if (metaText) {
    const meta = document.createElement('p');
    meta.className = 'prox-result__meta';
    meta.textContent = metaText;
    el.appendChild(meta);
  }
}

function setCompareSaveVisible(visible) {
  const saveBtn = document.getElementById('compare-prox-save');
  if (saveBtn) saveBtn.hidden = !visible;
}

function syncCompareModeFields() {
  const kind = document.getElementById('compare-prox-mode-kind');
  const nearest = document.getElementById('compare-prox-nearest-fields');
  const search = document.getElementById('compare-prox-search-fields');
  const val = kind instanceof HTMLSelectElement ? kind.value : 'nearest';
  if (nearest) nearest.hidden = val !== 'nearest';
  if (search) search.hidden = val !== 'search';
}

function clearComparePickerMapUi() {
  const meta = document.getElementById('compare-prox-picker-map-meta');
  const link = document.getElementById('compare-prox-picker-maps-link');
  if (meta) {
    meta.hidden = true;
    meta.textContent = '';
  }
  if (link instanceof HTMLAnchorElement) {
    link.hidden = true;
    link.removeAttribute('href');
  }
  if (cellPickerDirectionsRenderer) {
    cellPickerDirectionsRenderer.setMap(null);
  }
}

async function loadComparePickerMaps(key) {
  return loadGoogleMapsJs(key);
}

async function showComparePickerRoute(result) {
  const mapEl = document.getElementById('compare-prox-picker-map');
  const origin = cellPickerOrigin();
  const cfg = cellPickerCfg();
  const meta = document.getElementById('compare-prox-picker-map-meta');
  const link = document.getElementById('compare-prox-picker-maps-link');

  if (
    !mapEl ||
    !origin ||
    result?.status !== 'ok' ||
    result.place_lat == null ||
    result.place_lng == null ||
    !cfg.mapKey ||
    !cfg.mapId
  ) {
    return;
  }

  const durationLabel = formatMeta(result.duration_sec, result.distance_m);
  const href = directionsUrl(cellPickerTd, result);

  if (meta) {
    meta.textContent = [result.place_name, durationLabel].filter(Boolean).join(' · ');
    meta.hidden = !meta.textContent;
  }
  if (link instanceof HTMLAnchorElement) {
    if (href) {
      link.href = href;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
  }

  try {
    await loadComparePickerMaps(cfg.mapKey);
    const { Map } = await google.maps.importLibrary('maps');

    let DirectionsServiceCtor = google.maps.DirectionsService;
    let DirectionsRendererCtor = google.maps.DirectionsRenderer;
    try {
      const routesLib = await google.maps.importLibrary('routes');
      if (routesLib?.DirectionsService) DirectionsServiceCtor = routesLib.DirectionsService;
      if (routesLib?.DirectionsRenderer) DirectionsRendererCtor = routesLib.DirectionsRenderer;
    } catch {
      /* fall back */
    }

    if (!cellPickerMap) {
      cellPickerMap = new Map(mapEl, {
        center: origin,
        zoom: 12,
        mapId: cfg.mapId,
        gestureHandling: 'greedy',
      });
    }

    if (!cellPickerDirectionsRenderer) {
      cellPickerDirectionsRenderer = new DirectionsRendererCtor({
        map: cellPickerMap,
        suppressMarkers: false,
      });
    } else {
      cellPickerDirectionsRenderer.setMap(cellPickerMap);
    }

    if (!cellPickerDirectionsService) {
      cellPickerDirectionsService = new DirectionsServiceCtor();
    }

    const modeKey = JS_TRAVEL[cellPickerTravelMode] || 'DRIVING';
    const directions = await new Promise((resolve, reject) => {
      cellPickerDirectionsService.route(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: result.place_lat, lng: result.place_lng },
          travelMode: google.maps.TravelMode[modeKey],
        },
        (res, status) => {
          if (status === 'OK' && res) resolve(res);
          else reject(new Error(`Directions failed: ${status}`));
        },
      );
    });
    cellPickerDirectionsRenderer.setDirections(directions);
    google.maps.event.trigger(cellPickerMap, 'resize');
  } catch (e) {
    if (meta) {
      meta.hidden = false;
      meta.textContent =
        e instanceof Error ? e.message : 'Could not load directions on map';
    }
  }
}

function applyCompareChosenCandidate(candidate, origin) {
  cellPickerLastResult = {
    status: 'ok',
    place_id: candidate.place_id,
    place_name: candidate.place_name,
    place_lat: candidate.place_lat,
    place_lng: candidate.place_lng,
    duration_sec: candidate.duration_sec,
    distance_m: candidate.distance_m,
    maps_url: directionsUrl(cellPickerTd, {
      place_id: candidate.place_id,
      place_name: candidate.place_name,
      place_lat: candidate.place_lat,
      place_lng: candidate.place_lng,
    }),
    error_message: null,
  };
  void origin;
}

function renderCompareChoices(result, origin) {
  const box = document.getElementById('compare-prox-choices');
  if (!box) return;
  box.replaceChildren();
  const list = Array.isArray(result?.candidates) ? result.candidates : [];
  if (result?.status !== 'ok' || list.length <= 1) {
    box.hidden = true;
    if (result?.status === 'ok') {
      setCompareSaveVisible(true);
      void showComparePickerRoute(result);
    }
    return;
  }

  box.hidden = false;
  setCompareSaveVisible(false);
  clearComparePickerMapUi();
  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = 'Google returned several matches — pick the right one:';
  box.appendChild(intro);

  for (const candidate of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prox-choice secondary';

    const media = document.createElement('span');
    media.className = 'prox-choice__media';
    if (candidate.place_id) {
      const img = document.createElement('img');
      img.className = 'prox-choice__thumb';
      img.alt = '';
      img.loading = 'lazy';
      img.width = 72;
      img.height = 72;
      img.src = `/api/places/photo?place_id=${encodeURIComponent(candidate.place_id)}&max=120`;
      img.addEventListener('error', () => {
        const empty = document.createElement('span');
        empty.className = 'prox-choice__thumb prox-choice__thumb--empty';
        empty.setAttribute('aria-hidden', 'true');
        empty.textContent = 'No photo';
        img.replaceWith(empty);
      });
      media.appendChild(img);
    }

    const text = document.createElement('span');
    text.className = 'prox-choice__text';
    const title = document.createElement('strong');
    title.className = 'prox-choice__name';
    title.textContent = candidate.place_name || 'Place';
    const meta = document.createElement('span');
    meta.className = 'prox-choice__meta muted';
    meta.textContent = formatMeta(candidate.duration_sec, candidate.distance_m);
    text.appendChild(title);
    text.appendChild(meta);

    btn.appendChild(media);
    btn.appendChild(text);
    btn.addEventListener('click', async () => {
      box.querySelectorAll('.prox-choice').forEach((el) => el.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      applyCompareChosenCandidate(candidate, origin);
      renderCompareProxResult(cellPickerLastResult);
      setCompareSaveVisible(true);
      await showComparePickerRoute(cellPickerLastResult);
    });
    box.appendChild(btn);
  }
}

function closeCellPlacePicker() {
  const overlay = document.getElementById('compare-place-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  overlay.hidden = true;
  document.body.classList.remove('compare-column-overlay-open');
  cellPickerTd = null;
  cellPickerLastResult = null;
  clearComparePickerMapUi();
}

function openCellPlacePicker(td, currentResult) {
  const overlay = document.getElementById('compare-place-overlay');
  if (!(overlay instanceof HTMLElement)) return;

  cellPickerTd = td;
  cellPickerLastResult = null;
  cellPickerTravelMode = td.dataset.travelMode || 'DRIVE';

  const label = columnLabelForTd(td);
  const listingName =
    td.closest('tr')?.querySelector('.matrix-listing__name')?.textContent?.trim() || 'Listing';
  const title = document.getElementById('compare-place-overlay-title');
  const lede = document.getElementById('compare-prox-lede');
  const modeEl = document.getElementById('compare-prox-mode');
  const typeEl = document.getElementById('compare-prox-place-type');
  const modeKind = document.getElementById('compare-prox-mode-kind');

  const th = document.querySelector(
    `#compare-table thead th[data-criterion-id="${td.dataset.criterionId}"]`,
  );
  const placeTypeKey = th instanceof HTMLElement ? th.dataset.placeTypeKey || '' : '';

  if (title) title.textContent = 'Change location';
  if (lede) lede.textContent = `Pick a new location for ${label} · ${listingName}.`;
  if (modeEl instanceof HTMLSelectElement) modeEl.value = cellPickerTravelMode;
  if (placeTypeKey && typeEl instanceof HTMLInputElement) {
    setPlaceTypeValue(typeEl, placeTypeKey);
  } else if (placeTypeKey && typeEl instanceof HTMLSelectElement) {
    typeEl.value = placeTypeKey;
  }
  if (modeKind instanceof HTMLSelectElement) {
    modeKind.value = 'nearest';
  }

  setCompareProxStatus('');
  setCompareSaveVisible(false);
  const choices = document.getElementById('compare-prox-choices');
  if (choices) {
    choices.hidden = true;
    choices.replaceChildren();
  }
  cellPickerPlaceSearch?.clear?.();
  clearComparePickerMapUi();
  syncCompareModeFields();

  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  document.body.classList.add('compare-column-overlay-open');

  if (currentResult?.status === 'ok') {
    void showComparePickerRoute(currentResult);
  }
}

function initCellPlacePicker(signal) {
  const cfg = cellPickerCfg();
  const modeKind = document.getElementById('compare-prox-mode-kind');
  const runBtn = document.getElementById('compare-prox-run');
  const saveBtn = document.getElementById('compare-prox-save');
  const searchRoot = document.getElementById('compare-prox-place-search');
  const overlay = document.getElementById('compare-place-overlay');

  modeKind?.addEventListener('change', syncCompareModeFields, { signal });
  syncCompareModeFields();

  if (searchRoot && cfg.localeId) {
    cellPickerPlaceSearch = mountPlaceSearch(searchRoot, { localeId: cfg.localeId });
  }

  overlay?.querySelectorAll('[data-compare-place-close]').forEach((el) => {
    el.addEventListener('click', () => closeCellPlacePicker(), { signal });
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (overlay && !overlay.hidden) closeCellPlacePicker();
    },
    { signal },
  );

  runBtn?.addEventListener(
    'click',
    async () => {
    if (!cellPickerTd) return;
    const listingId = cellPickerTd.dataset.listingId;
    const origin = cellPickerOrigin();
    if (!listingId || !origin || !cfg.localeId) {
      setCompareProxStatus('Listing needs a geocoded location', { error: true });
      return;
    }

    setCompareProxStatus('Finding route…');
    setCompareSaveVisible(false);
    const choices = document.getElementById('compare-prox-choices');
    if (choices) {
      choices.hidden = true;
      choices.replaceChildren();
    }

    const modeEl = document.getElementById('compare-prox-mode');
    const travel_mode = modeEl instanceof HTMLSelectElement ? modeEl.value : 'DRIVE';
    cellPickerTravelMode = travel_mode;
    const kindVal =
      modeKind instanceof HTMLSelectElement ? modeKind.value : 'nearest';

    try {
      let body;
      if (kindVal === 'search') {
        const place = cellPickerPlaceSearch?.getResolved?.();
        if (!place) {
          setCompareProxStatus('Choose a place from search first', { error: true });
          return;
        }
        body = {
          listing_id: listingId,
          locale_id: cfg.localeId,
          kind: 'fixed_pin',
          pin_lat: place.lat,
          pin_lng: place.lng,
          pin_name: place.name,
          pin_place_id: place.placeId,
          travel_mode,
        };
      } else {
        const typeEl = document.getElementById('compare-prox-place-type');
        const phraseEl = document.getElementById('compare-prox-text-query');
        const text_query =
          phraseEl instanceof HTMLInputElement ? phraseEl.value.trim() : '';
        const place_type_key = readPlaceTypeValue(typeEl);
        if (text_query) {
          body = {
            listing_id: listingId,
            locale_id: cfg.localeId,
            kind: 'text_query',
            text_query,
            travel_mode,
          };
        } else if (place_type_key) {
          body = {
            listing_id: listingId,
            locale_id: cfg.localeId,
            kind: 'place_type',
            place_type_key,
            travel_mode,
          };
        } else {
          setCompareProxStatus('Choose a place type or enter a search phrase', {
            error: true,
          });
          return;
        }
      }

      const res = await fetch('/api/proximity/compute-one-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompareProxStatus(data.error || 'Failed', {
          error: true,
          planLimit: isPlanLimitResponse(res, data),
        });
        return;
      }
      cellPickerLastResult = data.result;
      renderCompareProxResult(data.result);
      renderCompareChoices(data.result, origin);
    } catch (e) {
      setCompareProxStatus(e instanceof Error ? e.message : 'Compute failed', { error: true });
    }
    },
    { signal },
  );

  saveBtn?.addEventListener(
    'click',
    async () => {
    if (!cellPickerTd || !cellPickerLastResult || cellPickerLastResult.status !== 'ok') return;
    const listingId = cellPickerTd.dataset.listingId;
    const criterionId = cellPickerTd.dataset.criterionId;
    if (!listingId || !criterionId) return;

    const origin = cellPickerOrigin();
    const href = directionsUrl(cellPickerTd, cellPickerLastResult);

    const lockRes = await fetch('/api/proximity/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: listingId,
        criterion_id: criterionId,
        locked: true,
        place_id: cellPickerLastResult.place_id,
        place_name: cellPickerLastResult.place_name,
        place_lat: cellPickerLastResult.place_lat,
        place_lng: cellPickerLastResult.place_lng,
        duration_sec: cellPickerLastResult.duration_sec,
        distance_m: cellPickerLastResult.distance_m,
        maps_url: href || cellPickerLastResult.maps_url,
      }),
    });
    const lockData = await lockRes.json();
    if (!lockRes.ok) {
      alert(lockData.error || 'Could not update location');
      return;
    }

    const td = cellPickerTd;
    const result = lockData.result || cellPickerLastResult;
    closeCellPlacePicker();
    renderCell(td, result);
    },
    { signal },
  );
}

async function hydrateSeededCells() {
  const cells = [...document.querySelectorAll('td[data-listing-id][data-criterion-id]')];
  for (const td of cells) {
    if (td.dataset.hydrated === '1') continue;

    const seeded = td.querySelector('.seeded');
    if (seeded) {
      try {
        const row = JSON.parse(seeded.textContent || '');
        if (row?.status === 'ok') {
          renderCell(td, row);
          td.dataset.hydrated = '1';
          continue;
        }
        if (row && row.status !== 'error') {
          renderCell(td, row);
          td.dataset.hydrated = '1';
          continue;
        }
      } catch {
        /* queue for lazy compute */
      }
    }

    td.replaceChildren();
    const idle = document.createElement('span');
    idle.className = 'cell-pending cell-pending--idle muted';
    idle.textContent = '—';
    td.appendChild(idle);
    td.dataset.status = 'pending';
    td.dataset.hydrated = '1';
    td.dataset.needsCompute = '1';
  }
}

function initLazyCellCompute(signal) {
  const pending = [...document.querySelectorAll('td[data-needs-compute="1"]')];
  if (!pending.length) return;

  const queue = [];
  let inFlight = 0;
  const maxConcurrent = 3;

  const pump = () => {
    while (inFlight < maxConcurrent && queue.length) {
      const td = queue.shift();
      if (!(td instanceof HTMLElement) || td.dataset.needsCompute !== '1') continue;
      td.dataset.needsCompute = '0';
      inFlight += 1;
      void computeCell(td).finally(() => {
        inFlight -= 1;
        pump();
      });
    }
  };

  const enqueue = (td) => {
    if (!(td instanceof HTMLElement) || td.dataset.needsCompute !== '1') return;
    if (queue.includes(td)) return;
    queue.push(td);
    pump();
  };

  if (!('IntersectionObserver' in window)) {
    for (const td of pending) enqueue(td);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        enqueue(entry.target);
      }
    },
    { rootMargin: '120px' },
  );

  for (const td of pending) observer.observe(td);

  signal?.addEventListener('abort', () => observer.disconnect(), { once: true });
}

let comparePageAbort = null;

function bootComparePage() {
  if (!document.querySelector('td[data-listing-id][data-criterion-id]')) return;

  if (comparePageAbort) comparePageAbort.abort();
  comparePageAbort = new AbortController();
  const { signal } = comparePageAbort;

  // Maps/directions state is tied to the previous page DOM — reset on soft nav.
  cellPickerMap = null;
  cellPickerDirectionsRenderer = null;
  cellPickerDirectionsService = null;
  cellPickerLastResult = null;
  cellPickerTd = null;

  initKindToggle(signal);
  initNearestMutualExclusive(
    document.querySelector('#nearest-fields [data-place-type-value]'),
    document.getElementById('criterion-text-query'),
    signal,
  );
  initNearestMutualExclusive(
    document.getElementById('compare-prox-place-type'),
    document.getElementById('compare-prox-text-query'),
    signal,
  );
  initCompareColumnOverlay(signal);
  initRefreshStaleButton(signal);
  initCriterionForm(signal);
  initDeleteButtons(signal);
  initCellPlacePicker(signal);
  mountAllPlaceTypePickers(document);
  void hydrateSeededCells().then(() => initLazyCellCompute(signal));
}

document.addEventListener('astro:page-load', bootComparePage);
