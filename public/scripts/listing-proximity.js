import { mountPlaceSearch } from './place-search.js';
import { iconBtn, iconBtnSpacer, iconMapPin, iconRoute, iconX } from './ui-icons.js';

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
  const el = document.getElementById('listing-map');
  if (!el) return null;
  const lat = Number(el.dataset.lat);
  const lng = Number(el.dataset.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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

function setActionButtons(visible) {
  const useBtn = document.getElementById('prox-use-listing');
  const addBtn = document.getElementById('prox-add-compare');
  if (useBtn) useBtn.hidden = !visible;
  if (addBtn) addBtn.hidden = !visible;
}

let lastResult = null;
let lastTravelMode = 'DRIVE';
let lastExplore = null;
let placeSearch = null;
let poiMarker = null;
let mapRef = null;

async function ensureMapOverlay(result) {
  const el = document.getElementById('listing-map');
  if (!el || result?.status !== 'ok' || result.place_lat == null || result.place_lng == null) {
    return;
  }
  const key = el.dataset.key;
  if (!key) return;

  if (!window.google?.maps?.importLibrary) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true;
      script.onload = () => resolve(undefined);
      script.onerror = () => reject(new Error('Failed to load Maps JS'));
      document.head.appendChild(script);
    });
  }

  const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
    google.maps.importLibrary('maps'),
    google.maps.importLibrary('marker'),
  ]);

  const listingPos = {
    lat: Number(el.dataset.lat),
    lng: Number(el.dataset.lng),
  };
  if (!mapRef) {
    mapRef = new Map(el, {
      center: listingPos,
      zoom: 13,
      mapId: el.dataset.mapId || undefined,
    });
  }

  if (poiMarker) poiMarker.map = null;
  const pin = new PinElement({ background: '#c45c26', borderColor: '#7a3414', glyph: 'P' });
  poiMarker = new AdvancedMarkerElement({
    map: mapRef,
    position: { lat: result.place_lat, lng: result.place_lng },
    title: result.place_name || 'Place',
    content: pin.element,
  });
}

function openLastRoute() {
  const origin = listingOrigin();
  if (!lastResult || lastResult.status !== 'ok' || !origin) return;
  const href = directionsHref(origin, {
    lat: lastResult.place_lat,
    lng: lastResult.place_lng,
    place_id: lastResult.place_id,
    place_name: lastResult.place_name,
    maps_url: lastResult.maps_url,
  }, lastTravelMode);
  openRouteOverlay({
    origin,
    destination: {
      lat: lastResult.place_lat,
      lng: lastResult.place_lng,
      placeId: lastResult.place_id,
      name: lastResult.place_name,
    },
    travelMode: lastTravelMode,
    title: lastResult.place_name ? `Listing → ${lastResult.place_name}` : 'Route',
    durationLabel: formatMeta(lastResult.duration_sec, lastResult.distance_m),
    externalUrl: href,
  });
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
      setActionButtons(true);
      openLastRoute();
    }
    return;
  }

  box.hidden = false;
  setActionButtons(false);
  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = 'Google returned several matches — pick the right one:';
  box.appendChild(intro);

  for (const candidate of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prox-choice secondary';
    const title = document.createElement('strong');
    title.className = 'prox-choice__name';
    title.textContent = candidate.place_name || 'Place';
    const meta = document.createElement('span');
    meta.className = 'prox-choice__meta muted';
    meta.textContent = formatMeta(candidate.duration_sec, candidate.distance_m);
    btn.appendChild(title);
    btn.appendChild(meta);
    btn.addEventListener('click', async () => {
      applyChosenCandidate(candidate, origin);
      box.hidden = true;
      box.replaceChildren();
      renderProxResult(lastResult);
      setActionButtons(true);
      await ensureMapOverlay(lastResult);
      openLastRoute();
    });
    box.appendChild(btn);
  }
}

async function presentProximityResult(result, origin) {
  const list = Array.isArray(result?.candidates) ? result.candidates : [];
  const needsChoice = result?.status === 'ok' && list.length > 1;
  if (!needsChoice && result?.status === 'ok') {
    await ensureMapOverlay(result);
    setActionButtons(true);
  } else {
    setActionButtons(false);
  }
  renderChoices(result, origin);
}

function syncModeFields() {
  const kind = document.getElementById('prox-mode-kind');
  const nearest = document.getElementById('prox-nearest-fields');
  const search = document.getElementById('prox-search-fields');
  const val = kind instanceof HTMLSelectElement ? kind.value : 'nearest';
  if (nearest) nearest.hidden = val !== 'nearest';
  if (search) search.hidden = val !== 'search';
}

function ensurePlaceThumb(li, placeId) {
  if (!placeId) return;
  const media = li.querySelector('[data-prox-thumb]');
  if (!media) return;
  let img = media.querySelector('img.prox-saved-item__thumb');
  const src = `/api/places/photo?place_id=${encodeURIComponent(placeId)}&max=120`;
  if (!img) {
    img = document.createElement('img');
    img.className = 'prox-saved-item__thumb';
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

function fillCompareCellActions(li, result) {
  const actions = li.querySelector('[data-cell-actions]');
  const meta = li.querySelector('.prox-cell-meta');
  const title = li.querySelector('strong');
  if (!actions) return;
  actions.replaceChildren();

  const columnLabel = li.dataset.columnLabel || 'Compare column';
  if (title) {
    title.textContent = columnLabel;
  }

  if (!result) {
    if (meta) meta.textContent = 'Computing…';
    return;
  }

  if (result.status !== 'ok') {
    if (meta) {
      meta.textContent = [result.status, result.error_message].filter(Boolean).join(' — ');
    }
    return;
  }

  ensurePlaceThumb(li, result.place_id);

  if (meta) {
    meta.textContent = [result.place_name, formatMeta(result.duration_sec, result.distance_m)]
      .filter(Boolean)
      .join(' · ');
  }

  const origin = {
    lat: Number(li.dataset.listingLat),
    lng: Number(li.dataset.listingLng),
  };
  const canOverlay =
    Number.isFinite(origin.lat) &&
    Number.isFinite(origin.lng) &&
    result.place_lat != null &&
    result.place_lng != null;
  const href = directionsHref(
    canOverlay ? origin : null,
    {
      lat: result.place_lat,
      lng: result.place_lng,
      place_id: result.place_id,
      place_name: result.place_name,
      maps_url: result.maps_url,
    },
    li.dataset.travelMode || 'DRIVE',
  );

  // Leading spacer so route/maps align with listing-only rows (remove + route + maps).
  actions.appendChild(iconBtnSpacer());

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
  document.querySelectorAll('#listing-places-list > li').forEach((li) => {
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
    const canOverlay =
      origin && Number.isFinite(lat) && Number.isFinite(lng);
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
        label: 'Remove this place from the listing-only list',
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
  });
}

function initProximityPanel() {
  const cfg = window.__WAYHOME_LISTING_PROX__;
  if (!cfg) return;

  const runBtn = document.getElementById('prox-run');
  const useBtn = document.getElementById('prox-use-listing');
  const addBtn = document.getElementById('prox-add-compare');
  const modeKind = document.getElementById('prox-mode-kind');
  const searchRoot = document.getElementById('prox-place-search');

  modeKind?.addEventListener('change', syncModeFields);
  syncModeFields();

  if (searchRoot) {
    placeSearch = mountPlaceSearch(searchRoot, {
      localeId: cfg.localeId,
    });
  }

  initListingPlaceActions();
  hydrateCompareCells();

  runBtn?.addEventListener('click', async () => {
    if (!cfg.hasLocation) {
      setProxResultStatus('needs_geocode', { error: true });
      return;
    }
    setProxResultStatus('Finding route…');
    setActionButtons(false);
    const choices = document.getElementById('prox-choices');
    if (choices) {
      choices.hidden = true;
      choices.replaceChildren();
    }

    const modeEl = document.getElementById('prox-mode');
    const travel_mode =
      modeEl instanceof HTMLSelectElement ? modeEl.value : 'DRIVE';
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
        lastExplore = { kind: 'search', place };
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
        lastExplore = { kind: 'nearest', place_type_key };
        renderProxResult(data.result);
        await presentProximityResult(data.result, origin);
      }
    } catch (e) {
      setProxResultStatus(
        e instanceof Error ? e.message : 'Compute failed',
        { error: true },
      );
    }
  });

  useBtn?.addEventListener('click', async () => {
    if (!lastResult || lastResult.status !== 'ok') return;
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
        maps_url: lastResult.maps_url,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Save failed');
      return;
    }
    location.reload();
  });

  addBtn?.addEventListener('click', async () => {
    if (!lastResult || lastResult.status !== 'ok' || !lastExplore) return;
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

    let criterionBody;
    if (lastExplore.kind === 'nearest') {
      criterionBody = {
        locale_id: cfg.localeId,
        kind: 'place_type',
        place_type_key: lastExplore.place_type_key,
        travel_mode: lastTravelMode,
        find_or_create: true,
      };
    } else {
      const place = lastExplore.place;
      criterionBody = {
        locale_id: cfg.localeId,
        kind: 'fixed_pin',
        pin_lat: place.lat,
        pin_lng: place.lng,
        pin_place_id: place.placeId,
        pin_name: place.name,
        travel_mode: lastTravelMode,
        label: place.name,
        find_or_create: true,
      };
    }

    const colRes = await fetch('/api/proximity/criteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criterionBody),
    });
    const colData = await colRes.json();
    if (!colRes.ok) {
      alert(colData.error || 'Could not add Compare column');
      return;
    }

    const criterionId = colData.criterion?.id;
    if (!criterionId) {
      alert('Compare column missing id');
      return;
    }

    if (lastExplore.kind === 'nearest') {
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
        alert(lockData.error || 'Lock failed');
        return;
      }
    } else {
      await fetch('/api/proximity/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: cfg.listingId,
          criterion_id: criterionId,
        }),
      });
    }

    location.reload();
  });
}

initProximityPanel();
