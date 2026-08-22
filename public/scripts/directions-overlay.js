const JS_TRAVEL = {
  DRIVE: 'DRIVING',
  WALK: 'WALKING',
  BICYCLE: 'BICYCLING',
  TRANSIT: 'TRANSIT',
};

let mapsReady = null;
let map = null;
let directionsRenderer = null;
let directionsService = null;
let lastFocus = null;

function ensureDom() {
  let root = document.getElementById('directions-overlay');
  if (!root) return null;
  // main.app-main uses backdrop-filter, which makes position:fixed relative to
  // main instead of the viewport — reparent so the dialog centers on screen.
  if (root.parentElement !== document.body) {
    document.body.appendChild(root);
  }
  return root;
}

async function loadMaps(key) {
  if (window.google?.maps?.importLibrary) return;
  if (mapsReady) return mapsReady;
  mapsReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve(undefined);
    script.onerror = () => reject(new Error('Failed to load Maps JS'));
    document.head.appendChild(script);
  });
  return mapsReady;
}

function closeOverlay() {
  const root = ensureDom();
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove('directions-overlay-open');
  if (directionsRenderer) {
    directionsRenderer.setMap(null);
  }
  if (lastFocus instanceof HTMLElement) {
    lastFocus.focus();
  }
}

function bindCloseHandlers(root) {
  if (root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.querySelectorAll('[data-overlay-close]').forEach((el) => {
    el.addEventListener('click', () => closeOverlay());
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) closeOverlay();
  });
}

/**
 * @param {{
 *   origin: { lat: number, lng: number },
 *   destination: { lat: number, lng: number, placeId?: string | null, name?: string | null },
 *   travelMode: string,
 *   title?: string,
 *   durationLabel?: string,
 *   externalUrl?: string | null,
 *   mapKey: string,
 *   mapId: string,
 * }} opts
 */
export async function openDirectionsOverlay(opts) {
  const root = ensureDom();
  if (!root) {
    console.error('Directions overlay markup missing');
    return;
  }

  const {
    origin,
    destination,
    travelMode = 'DRIVE',
    title = 'Route',
    durationLabel = '',
    externalUrl = null,
    mapKey,
    mapId,
  } = opts;

  if (
    !mapKey ||
    !mapId ||
    !Number.isFinite(origin?.lat) ||
    !Number.isFinite(origin?.lng) ||
    !Number.isFinite(destination?.lat) ||
    !Number.isFinite(destination?.lng)
  ) {
    return;
  }

  bindCloseHandlers(root);
  lastFocus = document.activeElement;

  const titleEl = document.getElementById('directions-overlay-title');
  const metaEl = document.getElementById('directions-overlay-meta');
  const errEl = document.getElementById('directions-overlay-error');
  const extEl = document.getElementById('directions-overlay-external');
  const mapEl = document.getElementById('directions-overlay-map');

  if (titleEl) titleEl.textContent = title;
  if (metaEl) {
    metaEl.textContent = durationLabel || '';
    metaEl.hidden = !durationLabel;
  }
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = '';
  }
  if (extEl) {
    if (externalUrl) {
      extEl.href = externalUrl;
      extEl.hidden = false;
    } else {
      extEl.hidden = true;
    }
  }

  root.hidden = false;
  document.body.classList.add('directions-overlay-open');
  root.scrollTop = 0;

  try {
    await loadMaps(mapKey);
    const { Map } = await google.maps.importLibrary('maps');

    let DirectionsServiceCtor = google.maps.DirectionsService;
    let DirectionsRendererCtor = google.maps.DirectionsRenderer;
    try {
      const routesLib = await google.maps.importLibrary('routes');
      if (routesLib?.DirectionsService) DirectionsServiceCtor = routesLib.DirectionsService;
      if (routesLib?.DirectionsRenderer) DirectionsRendererCtor = routesLib.DirectionsRenderer;
    } catch {
      /* fall back to google.maps.* */
    }

    if (!map) {
      map = new Map(mapEl, {
        center: origin,
        zoom: 12,
        mapId,
        gestureHandling: 'greedy',
      });
    }

    if (!directionsRenderer) {
      directionsRenderer = new DirectionsRendererCtor({
        map,
        suppressMarkers: false,
      });
    } else {
      directionsRenderer.setMap(map);
    }

    if (!directionsService) {
      directionsService = new DirectionsServiceCtor();
    }

    const modeKey = JS_TRAVEL[travelMode] || 'DRIVING';
    const request = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: google.maps.TravelMode[modeKey],
    };

    const result = await new Promise((resolve, reject) => {
      directionsService.route(request, (res, status) => {
        if (status === 'OK' && res) resolve(res);
        else reject(new Error(`Directions failed: ${status}`));
      });
    });
    directionsRenderer.setDirections(result);
  } catch (e) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent =
        e instanceof Error ? e.message : 'Could not load directions';
    }
  }
}

window.openDirectionsOverlay = openDirectionsOverlay;
window.closeDirectionsOverlay = closeOverlay;
ensureDom();
