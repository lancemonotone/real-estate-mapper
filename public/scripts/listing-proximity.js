import { mountPlaceSearch } from './place-search.js';

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

function directionsHref(origin, result, travelMode) {
  if (!origin || result?.place_lat == null || result?.place_lng == null) {
    return result?.maps_url || null;
  }
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    travelmode: TRAVELMODE[travelMode] || 'driving',
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

function listingOrigin() {
  const el = document.getElementById('listing-map');
  if (!el) return null;
  const lat = Number(el.dataset.lat);
  const lng = Number(el.dataset.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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
  const metaText = [formatDuration(result.duration_sec), formatMiles(result.distance_m)]
    .filter(Boolean)
    .join(' · ');
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
let lastExplore = null; // { kind: 'nearest'|'search', place_type_key?, place? }
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
  const cfg = window.__WAYHOME_LISTING_PROX__;
  const origin = listingOrigin();
  if (!cfg || !lastResult || lastResult.status !== 'ok' || !origin) return;
  const href = directionsHref(origin, lastResult, lastTravelMode);
  const durationLabel = [
    formatDuration(lastResult.duration_sec),
    formatMiles(lastResult.distance_m),
  ]
    .filter(Boolean)
    .join(' · ');
  window.openDirectionsOverlay?.({
    origin,
    destination: {
      lat: lastResult.place_lat,
      lng: lastResult.place_lng,
      placeId: lastResult.place_id,
      name: lastResult.place_name,
    },
    travelMode: lastTravelMode,
    title: lastResult.place_name ? `Listing → ${lastResult.place_name}` : 'Route',
    durationLabel,
    externalUrl: href,
    mapKey: cfg.mapKey,
    mapId: cfg.mapId,
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
    maps_url: directionsHref(origin, candidate, lastTravelMode),
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
    title.textContent = candidate.place_name || 'Place';
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = [
      formatDuration(candidate.duration_sec),
      formatMiles(candidate.distance_m),
    ]
      .filter(Boolean)
      .join(' · ');
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
      onResolved() {
        /* stored via getResolved */
      },
    });
  }

  document.querySelectorAll('.prox-unlock').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const criterionId = btn.getAttribute('data-criterion-id');
      if (!criterionId) return;
      const res = await fetch('/api/proximity/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: cfg.listingId,
          criterion_id: criterionId,
          locked: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Unlock failed');
        return;
      }
      location.reload();
    });
  });

  document.querySelectorAll('.listing-place-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
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
    });
  });

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
    const href = directionsHref(origin, lastResult, lastTravelMode);

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

    location.href = `/app/locales/${cfg.localeId}/compare`;
  });
}

initProximityPanel();
