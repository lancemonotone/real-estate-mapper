import { mountPlaceSearch } from './place-search.js';
import {
  iconBtn,
  iconMapPin,
  iconPencil,
  iconRoute,
  iconX,
} from './ui-icons.js';

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

function directionsHref(origin, dest, travelMode) {
  if (!origin || dest?.lat == null || dest?.lng == null) {
    return dest?.maps_url || null;
  }
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    travelmode: TRAVELMODE[travelMode] || 'driving',
  });
  const placeId = normalizePlaceId(dest.place_id);
  if (placeId) {
    params.set('destination', dest.place_name || `${dest.lat},${dest.lng}`);
    params.set('destination_place_id', placeId);
  } else {
    params.set('destination', `${dest.lat},${dest.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function listingOrigin() {
  const sources = [
    document.getElementById('prox-picker-map'),
    document.getElementById('listing-map'),
  ];
  for (const el of sources) {
    if (!el) continue;
    const lat = Number(el.dataset.lat);
    const lng = Number(el.dataset.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

/** Listing location, else Locale center — keeps the picker map from opening blank. */
function pickerMapCenter() {
  const listing = listingOrigin();
  if (listing) return listing;
  const mapEl = document.getElementById('prox-picker-map');
  const cfg = mapsConfig();
  const lat = Number(mapEl?.dataset.localeLat ?? cfg.localeLat);
  const lng = Number(mapEl?.dataset.localeLng ?? cfg.localeLng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }
  return null;
}

function resetPickerMapState() {
  pickerMap = null;
  pickerDirectionsRenderer = null;
  pickerDirectionsService = null;
}

async function ensurePickerBaseMap() {
  const mapEl = document.getElementById('prox-picker-map');
  const cfg = mapsConfig();
  const center = pickerMapCenter();
  if (!mapEl || !center || !cfg.mapKey || !cfg.mapId) return;

  try {
    await loadPickerMaps(cfg.mapKey);
    const { Map } = await google.maps.importLibrary('maps');

    if (pickerMap && typeof pickerMap.getDiv === 'function' && pickerMap.getDiv() !== mapEl) {
      resetPickerMapState();
    }

    if (!pickerMap) {
      pickerMap = new Map(mapEl, {
        center,
        zoom: 12,
        mapId: cfg.mapId,
        gestureHandling: 'greedy',
      });
    } else {
      pickerMap.setCenter(center);
    }

    requestAnimationFrame(() => {
      google.maps.event.trigger(pickerMap, 'resize');
    });
  } catch {
    /* leave box empty if Maps fails — Find route still surfaces errors */
  }
}

function mapsConfig() {
  return window.__WAYHOME_LISTING_PROX__ || window.__WAYHOME_MAPS__ || {};
}

function openRouteOverlay({ origin, destination, travelMode, title, durationLabel, externalUrl }) {
  const cfg = mapsConfig();
  window.openDirectionsOverlay?.({
    origin,
    destination,
    travelMode,
    title,
    durationLabel,
    externalUrl,
    mapKey: cfg.mapKey,
    mapId: cfg.mapId,
  });
}

function setProxResultStatus(message, { error = false } = {}) {
  const el = document.getElementById('prox-result');
  if (!el) return;
  el.replaceChildren();
  if (!message) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const status = document.createElement('p');
  status.className = error ? 'prox-result__status is-error' : 'prox-result__status';
  status.textContent = message;
  el.appendChild(status);
}

function renderProxResult(result) {
  const el = document.getElementById('prox-result');
  if (!el) return;
  el.replaceChildren();
  if (!result) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (result.status !== 'ok') {
    const status = document.createElement('p');
    status.className = 'prox-result__status is-error';
    status.textContent = [result.status, result.error_message].filter(Boolean).join(' — ');
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

function setSaveVisible(visible) {
  const saveBtn = document.getElementById('prox-save');
  if (saveBtn) saveBtn.hidden = !visible;
}

const JS_TRAVEL = {
  DRIVE: 'DRIVING',
  WALK: 'WALKING',
  BICYCLE: 'BICYCLING',
  TRANSIT: 'TRANSIT',
};

let lastResult = null;
let lastTravelMode = 'DRIVE';
let placeSearch = null;
let pickerMap = null;
let pickerDirectionsRenderer = null;
let pickerDirectionsService = null;
let pickerMapsReady = null;

/** @type {{ mode: 'add-listing' | 'edit-criterion' | 'edit-listing', criterionId?: string, placeRowId?: string, label?: string, travelMode?: string }} */
let pickerContext = { mode: 'add-listing' };

async function loadPickerMaps(key) {
  if (window.google?.maps?.importLibrary) return;
  if (pickerMapsReady) return pickerMapsReady;
  pickerMapsReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve(undefined);
    script.onerror = () => reject(new Error('Failed to load Maps JS'));
    document.head.appendChild(script);
  });
  return pickerMapsReady;
}

function clearPickerMapUi() {
  const meta = document.getElementById('prox-picker-map-meta');
  const link = document.getElementById('prox-picker-maps-link');
  if (meta) {
    meta.hidden = true;
    meta.textContent = '';
  }
  if (link instanceof HTMLAnchorElement) {
    link.hidden = true;
    link.removeAttribute('href');
  }
  if (pickerDirectionsRenderer) {
    pickerDirectionsRenderer.setMap(null);
  }
}

async function showPickerRoute(result) {
  const mapEl = document.getElementById('prox-picker-map');
  const origin = listingOrigin();
  const cfg = mapsConfig();
  const meta = document.getElementById('prox-picker-map-meta');
  const link = document.getElementById('prox-picker-maps-link');

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
  const href = directionsHref(
    origin,
    {
      lat: result.place_lat,
      lng: result.place_lng,
      place_id: result.place_id,
      place_name: result.place_name,
      maps_url: result.maps_url,
    },
    lastTravelMode,
  );

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
    await loadPickerMaps(cfg.mapKey);
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

    if (!pickerMap) {
      pickerMap = new Map(mapEl, {
        center: origin,
        zoom: 12,
        mapId: cfg.mapId,
        gestureHandling: 'greedy',
      });
    } else if (typeof pickerMap.getDiv === 'function' && pickerMap.getDiv() !== mapEl) {
      resetPickerMapState();
      pickerMap = new Map(mapEl, {
        center: origin,
        zoom: 12,
        mapId: cfg.mapId,
        gestureHandling: 'greedy',
      });
    }

    if (!pickerDirectionsRenderer) {
      pickerDirectionsRenderer = new DirectionsRendererCtor({
        map: pickerMap,
        suppressMarkers: false,
      });
    } else {
      pickerDirectionsRenderer.setMap(pickerMap);
    }

    if (!pickerDirectionsService) {
      pickerDirectionsService = new DirectionsServiceCtor();
    }

    const modeKey = JS_TRAVEL[lastTravelMode] || 'DRIVING';
    const request = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: result.place_lat, lng: result.place_lng },
      travelMode: google.maps.TravelMode[modeKey],
    };

    const directions = await new Promise((resolve, reject) => {
      pickerDirectionsService.route(request, (res, status) => {
        if (status === 'OK' && res) resolve(res);
        else reject(new Error(`Directions failed: ${status}`));
      });
    });
    pickerDirectionsRenderer.setDirections(directions);
    google.maps.event.trigger(pickerMap, 'resize');
  } catch (e) {
    if (meta) {
      meta.hidden = false;
      meta.textContent =
        e instanceof Error ? e.message : 'Could not load directions on map';
    }
  }
}

function applyChosenCandidate(candidate, origin) {
  lastResult = {
    status: 'ok',
    place_id: candidate.place_id,
    place_name: candidate.place_name,
    place_lat: candidate.place_lat,
    place_lng: candidate.place_lng,
    duration_sec: candidate.duration_sec,
    distance_m: candidate.distance_m,
    maps_url: directionsHref(
      origin,
      {
        lat: candidate.place_lat,
        lng: candidate.place_lng,
        place_id: candidate.place_id,
        place_name: candidate.place_name,
      },
      lastTravelMode,
    ),
    error_message: null,
  };
}

function renderChoices(result, origin) {
  const box = document.getElementById('prox-choices');
  if (!box) return;
  box.replaceChildren();
  const list = Array.isArray(result?.candidates) ? result.candidates : [];
  if (result?.status !== 'ok' || list.length <= 1) {
    box.hidden = true;
    if (result?.status === 'ok') {
      setSaveVisible(true);
      void showPickerRoute(result);
    }
    return;
  }

  box.hidden = false;
  setSaveVisible(false);
  clearPickerMapUi();
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
    } else {
      const empty = document.createElement('span');
      empty.className = 'prox-choice__thumb prox-choice__thumb--empty';
      empty.setAttribute('aria-hidden', 'true');
      empty.textContent = 'No photo';
      media.appendChild(empty);
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
      box.querySelectorAll('.prox-choice').forEach((el) => {
        el.classList.remove('is-selected');
      });
      btn.classList.add('is-selected');
      applyChosenCandidate(candidate, origin);
      renderProxResult(lastResult);
      setSaveVisible(true);
      await showPickerRoute(lastResult);
    });
    box.appendChild(btn);
  }
}

async function presentProximityResult(result, origin) {
  const list = Array.isArray(result?.candidates) ? result.candidates : [];
  const needsChoice = result?.status === 'ok' && list.length > 1;
  if (!needsChoice && result?.status === 'ok') {
    setSaveVisible(true);
  } else {
    setSaveVisible(false);
  }
  renderChoices(result, origin);
}

function ensurePlaceThumb(li, placeId) {
  if (!placeId) return;
  const media = li.querySelector('[data-prox-thumb]');
  if (!media) return;
  let img = media.querySelector(
    'img.prox-saved-item__thumb, img.listing-row__thumb, img.matrix-listing__thumb',
  );
  const src = `/api/places/photo?place_id=${encodeURIComponent(placeId)}&max=120`;
  if (!img) {
    img = document.createElement('img');
    img.className = 'matrix-listing__thumb prox-saved-item__thumb';
    img.alt = '';
    img.loading = 'lazy';
    img.width = 72;
    img.height = 54;
    img.addEventListener('error', () => {
      img.hidden = true;
    });
    media.replaceChildren(img);
  }
  if (img.getAttribute('src') !== src) {
    img.hidden = false;
    img.src = src;
  }
}

function syncModeFields() {
  const kind = document.getElementById('prox-mode-kind');
  const nearest = document.getElementById('prox-nearest-fields');
  const search = document.getElementById('prox-search-fields');
  const val = kind instanceof HTMLSelectElement ? kind.value : 'nearest';
  if (nearest) nearest.hidden = val !== 'nearest';
  if (search) search.hidden = val !== 'search';
}

function openPlacePicker(detail) {
  pickerContext = {
    mode: detail?.mode || 'add-listing',
    criterionId: detail?.criterionId,
    placeRowId: detail?.placeRowId,
    label: detail?.label,
    travelMode: detail?.travelMode || 'DRIVE',
  };

  const title = document.getElementById('listing-overlay-place-title');
  const lede = document.getElementById('prox-lede');
  const modeEl = document.getElementById('prox-mode');
  if (title instanceof HTMLElement) {
    title.textContent =
      pickerContext.mode === 'add-listing' ? 'Add place' : 'Change location';
  }
  if (lede instanceof HTMLElement) {
    if (pickerContext.mode === 'edit-criterion' && pickerContext.label) {
      lede.textContent = `Pick a new location for ${pickerContext.label}.`;
    } else if (pickerContext.mode === 'edit-listing') {
      lede.textContent = 'Pick a new location for this place.';
    } else {
      lede.textContent = 'Find a nearby type or search a place, then save.';
    }
  }
  if (modeEl instanceof HTMLSelectElement) {
    modeEl.value = pickerContext.travelMode || 'DRIVE';
  }

  lastResult = null;
  setProxResultStatus('');
  setSaveVisible(false);
  clearPickerMapUi();
  const choices = document.getElementById('prox-choices');
  if (choices) {
    choices.hidden = true;
    choices.replaceChildren();
  }
  placeSearch?.clear?.();
  syncModeFields();

  window.__WAYHOME_LISTING_OVERLAY__?.open('place');
  void ensurePickerBaseMap();
}

function fillCompareCellActions(li, result) {
  const actions = li.querySelector('[data-cell-actions]');
  const meta = li.querySelector('.prox-cell-meta');
  const title = li.querySelector('strong, .matrix-listing__name');
  if (!actions) return;
  actions.replaceChildren();

  const columnLabel = li.dataset.columnLabel || 'Travel column';
  if (title) {
    title.textContent = columnLabel;
  }

  if (!result) {
    if (meta) meta.textContent = 'Computing…';
  } else if (result.status !== 'ok') {
    if (meta) {
      meta.textContent = [result.status, result.error_message].filter(Boolean).join(' — ');
    }
  } else {
    ensurePlaceThumb(li, result.place_id);

    if (meta) {
      meta.textContent = [result.place_name, formatMeta(result.duration_sec, result.distance_m)]
        .filter(Boolean)
        .join(' · ');
    }
  }

  const origin = {
    lat: Number(li.dataset.listingLat),
    lng: Number(li.dataset.listingLng),
  };
  const canOverlay =
    result?.status === 'ok' &&
    Number.isFinite(origin.lat) &&
    Number.isFinite(origin.lng) &&
    result.place_lat != null &&
    result.place_lng != null;
  const href =
    result?.status === 'ok'
      ? directionsHref(
          canOverlay ? origin : null,
          {
            lat: result.place_lat,
            lng: result.place_lng,
            place_id: result.place_id,
            place_name: result.place_name,
            maps_url: result.maps_url,
          },
          li.dataset.travelMode || 'DRIVE',
        )
      : null;

  actions.appendChild(
    iconBtn({
      label: `Change location for ${columnLabel}`,
      icon: iconPencil,
      onClick: () =>
        openPlacePicker({
          mode: 'edit-criterion',
          criterionId: li.dataset.criterionId,
          label: columnLabel,
          travelMode: li.dataset.travelMode || 'DRIVE',
        }),
    }),
  );

  if (canOverlay) {
    actions.appendChild(
      iconBtn({
        label: 'Show the route on a map overlay',
        icon: iconRoute,
        onClick: () =>
          openRouteOverlay({
            origin,
            destination: {
              lat: result.place_lat,
              lng: result.place_lng,
              placeId: result.place_id,
              name: result.place_name,
            },
            travelMode: li.dataset.travelMode || 'DRIVE',
            title: result.place_name ? `Listing → ${result.place_name}` : 'Route',
            durationLabel: formatMeta(result.duration_sec, result.distance_m),
            externalUrl: href,
          }),
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
}

async function hydrateCompareCells() {
  const cells = [...document.querySelectorAll('[data-listing-prox-cell]')];
  for (const li of cells) {
    const seeded = li.querySelector('.seeded');
    let row = null;
    if (seeded) {
      try {
        row = JSON.parse(seeded.textContent || '');
      } catch {
        row = null;
      }
    }
    if (row?.status === 'ok') {
      fillCompareCellActions(li, row);
      continue;
    }
    fillCompareCellActions(li, null);
    const listingId = li.dataset.listingId;
    const criterionId = li.dataset.criterionId;
    if (!listingId || !criterionId) continue;
    try {
      const res = await fetch('/api/proximity/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, criterion_id: criterionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        fillCompareCellActions(li, {
          status: 'error',
          error_message: data.error || `HTTP ${res.status}`,
        });
        continue;
      }
      fillCompareCellActions(li, data.result);
    } catch (e) {
      fillCompareCellActions(li, {
        status: 'error',
        error_message: e instanceof Error ? e.message : 'Compute failed',
      });
    }
  }
}

function initListingPlaceActions() {
  const origin = listingOrigin();
  document.querySelectorAll('#listing-places-list > tr').forEach((li) => {
    if (li.hasAttribute('data-listing-prox-cell')) return;
    const actions = li.querySelector('[data-listing-place-actions]');
    if (!actions) return;
    actions.replaceChildren();

    const lat = Number(li.dataset.placeLat);
    const lng = Number(li.dataset.placeLng);
    const durationSec = li.dataset.durationSec ? Number(li.dataset.durationSec) : null;
    const distanceM = li.dataset.distanceM ? Number(li.dataset.distanceM) : null;
    const travelMode = li.dataset.travelMode || 'DRIVE';
    const mapsUrl = li.dataset.mapsUrl || null;
    const placeName = li.dataset.placeName || 'Place';
    const canOverlay = origin && Number.isFinite(lat) && Number.isFinite(lng);
    const href =
      mapsUrl ||
      (canOverlay
        ? directionsHref(
            origin,
            {
              lat,
              lng,
              place_id: li.dataset.placeId,
              place_name: placeName,
            },
            travelMode,
          )
        : null);

    actions.appendChild(
      iconBtn({
        label: `Change location for ${placeName}`,
        icon: iconPencil,
        onClick: () =>
          openPlacePicker({
            mode: 'edit-listing',
            placeRowId: li.getAttribute('data-place-row-id') || undefined,
            label: placeName,
            travelMode,
          }),
      }),
    );

    if (canOverlay) {
      actions.appendChild(
        iconBtn({
          label: 'Show the route on a map overlay',
          icon: iconRoute,
          onClick: () =>
            openRouteOverlay({
              origin,
              destination: {
                lat,
                lng,
                placeId: li.dataset.placeId,
                name: placeName,
              },
              travelMode,
              title: `Listing → ${placeName}`,
              durationLabel: formatMeta(durationSec, distanceM),
              externalUrl: href,
            }),
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

    actions.appendChild(
      iconBtn({
        label: 'Remove this place from the listing',
        icon: iconX,
        onClick: async () => {
          const id = li.getAttribute('data-place-row-id');
          if (!id) return;
          const res = await fetch(`/api/proximity/listing-places?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || 'Remove failed');
            return;
          }
          location.reload();
        },
      }),
    );
  });
}

async function savePickerResult(cfg) {
  if (!lastResult || lastResult.status !== 'ok') return;

  const origin = listingOrigin();
  const href = directionsHref(
    origin,
    {
      lat: lastResult.place_lat,
      lng: lastResult.place_lng,
      place_id: lastResult.place_id,
      place_name: lastResult.place_name,
      maps_url: lastResult.maps_url,
    },
    lastTravelMode,
  );

  if (pickerContext.mode === 'edit-criterion') {
    const criterionId = pickerContext.criterionId;
    if (!criterionId) {
      alert('Missing Travel Times column');
      return;
    }
    const lockRes = await fetch('/api/proximity/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: cfg.listingId,
        criterion_id: criterionId,
        locked: true,
        place_id: lastResult.place_id,
        place_name: lastResult.place_name,
        place_lat: lastResult.place_lat,
        place_lng: lastResult.place_lng,
        duration_sec: lastResult.duration_sec,
        distance_m: lastResult.distance_m,
        maps_url: href || lastResult.maps_url,
      }),
    });
    const lockData = await lockRes.json();
    if (!lockRes.ok) {
      alert(lockData.error || 'Could not update location');
      return;
    }
    location.reload();
    return;
  }

  if (pickerContext.mode === 'edit-listing') {
    const id = pickerContext.placeRowId;
    if (!id) {
      alert('Missing place id');
      return;
    }
    const res = await fetch('/api/proximity/listing-places', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        place_id: lastResult.place_id,
        name: lastResult.place_name,
        lat: lastResult.place_lat,
        lng: lastResult.place_lng,
        travel_mode: lastTravelMode,
        duration_sec: lastResult.duration_sec,
        distance_m: lastResult.distance_m,
        maps_url: href || lastResult.maps_url,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Could not update location');
      return;
    }
    location.reload();
    return;
  }

  const res = await fetch('/api/proximity/listing-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listing_id: cfg.listingId,
      place_id: lastResult.place_id,
      name: lastResult.place_name,
      lat: lastResult.place_lat,
      lng: lastResult.place_lng,
      travel_mode: lastTravelMode,
      duration_sec: lastResult.duration_sec,
      distance_m: lastResult.distance_m,
      maps_url: href || lastResult.maps_url,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Save failed');
    return;
  }
  location.reload();
}

function initProximityPanel() {
  const cfg = window.__WAYHOME_LISTING_PROX__;
  if (!cfg) return;

  const panel = document.getElementById('listing-overlay-place') || document.body;
  if (panel._proxAbort instanceof AbortController) {
    panel._proxAbort.abort();
  }
  const ac = new AbortController();
  panel._proxAbort = ac;
  const { signal } = ac;

  resetPickerMapState();
  placeSearch = null;

  const runBtn = document.getElementById('prox-run');
  const saveBtn = document.getElementById('prox-save');
  const modeKind = document.getElementById('prox-mode-kind');
  const searchRoot = document.getElementById('prox-place-search');

  modeKind?.addEventListener('change', syncModeFields, { signal });
  syncModeFields();

  if (searchRoot) {
    placeSearch = mountPlaceSearch(searchRoot, {
      localeId: cfg.localeId,
    });
  }

  window.addEventListener(
    'listing-place-picker',
    (event) => {
      openPlacePicker(event.detail || { mode: 'add-listing' });
    },
    { signal },
  );

  initListingPlaceActions();
  hydrateCompareCells();

  runBtn?.addEventListener(
    'click',
    async () => {
    if (!cfg.hasLocation) {
      setProxResultStatus('needs_geocode', { error: true });
      return;
    }
    setProxResultStatus('Finding route…');
    setSaveVisible(false);
    const choices = document.getElementById('prox-choices');
    if (choices) {
      choices.hidden = true;
      choices.replaceChildren();
    }

    const modeEl = document.getElementById('prox-mode');
    const travel_mode = modeEl instanceof HTMLSelectElement ? modeEl.value : 'DRIVE';
    const kindVal =
      modeKind instanceof HTMLSelectElement ? modeKind.value : 'nearest';
    const origin = listingOrigin();

    try {
      if (kindVal === 'search') {
        const place = placeSearch?.getResolved?.();
        if (!place) {
          setProxResultStatus('Choose a place from search first', { error: true });
          return;
        }
        const res = await fetch('/api/proximity/compute-one-off', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: cfg.listingId,
            locale_id: cfg.localeId,
            kind: 'fixed_pin',
            pin_lat: place.lat,
            pin_lng: place.lng,
            pin_name: place.name,
            pin_place_id: place.placeId,
            travel_mode,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setProxResultStatus(data.error || 'Failed', { error: true });
          return;
        }
        lastResult = data.result;
        lastTravelMode = travel_mode;
        renderProxResult(data.result);
        await presentProximityResult(data.result, origin);
      } else {
        const typeEl = document.getElementById('prox-place-type');
        const place_type_key =
          typeEl instanceof HTMLSelectElement ? typeEl.value : '';
        const res = await fetch('/api/proximity/compute-one-off', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: cfg.listingId,
            locale_id: cfg.localeId,
            kind: 'place_type',
            place_type_key,
            travel_mode,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setProxResultStatus(data.error || 'Failed', { error: true });
          return;
        }
        lastResult = data.result;
        lastTravelMode = travel_mode;
        renderProxResult(data.result);
        await presentProximityResult(data.result, origin);
      }
    } catch (e) {
      setProxResultStatus(e instanceof Error ? e.message : 'Compute failed', { error: true });
    }
    },
    { signal },
  );

  saveBtn?.addEventListener(
    'click',
    async () => {
    try {
      await savePickerResult(cfg);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    }
    },
    { signal },
  );
}

initProximityPanel();
document.addEventListener('astro:page-load', initProximityPanel);
