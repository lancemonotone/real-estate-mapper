import { createPinHoverController } from './map-pin-hover.js';

async function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve(undefined);
    script.onerror = () => reject(new Error('Failed to load Maps JS'));
    document.head.appendChild(script);
  });
}

async function initListingMap() {
  const el = document.getElementById('listing-map');
  if (!el || el.dataset.mapReady === '1') return;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;
  const lat = Number(el.dataset.lat);
  const lng = Number(el.dataset.lng);
  const title = el.dataset.title || 'Listing';
  const address = el.dataset.address || '';
  const photoUrl = el.dataset.photoUrl || '';

  if (!key || !mapId) {
    el.textContent = 'Missing PUBLIC_GOOGLE_MAPS_BROWSER_KEY or PUBLIC_GOOGLE_MAPS_MAP_ID';
    return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    el.textContent = 'No geocoded location to show';
    return;
  }

  await loadGoogleMaps(key);

  const { Map, InfoWindow } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');

  el.replaceChildren();
  el.dataset.mapReady = '1';

  const position = { lat, lng };
  const map = new Map(el, {
    center: position,
    zoom: 15,
    mapId,
  });

  const pin = new PinElement({
    background: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0d9488',
    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d97706',
    glyphColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-contrast').trim() || '#ffffff',
  });

  const marker = new AdvancedMarkerElement({
    map,
    position,
    title,
    content: pin.element,
  });

  const pinHover = createPinHoverController(map, InfoWindow);
  pinHover.bind(marker, pin.element, {
    name: title,
    address,
    photoUrl: photoUrl || null,
  });
}

function bootListingMap() {
  initListingMap().catch((err) => {
    const el = document.getElementById('listing-map');
    if (el) el.textContent = err instanceof Error ? err.message : 'Map failed';
  });
}

bootListingMap();
document.addEventListener('astro:page-load', bootListingMap);
