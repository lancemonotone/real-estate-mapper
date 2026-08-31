import { createPinHoverController } from './map-pin-hover.js';
import { fitMapForPinTooltips } from './map-fit.js';
import { whenMapVisible } from './map-lazy.js';

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

function milesToMeters(miles) {
  return miles * 1609.344;
}

function parseListings(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let localeMapBootId = 0;

async function initLocaleMap() {
  let el = document.getElementById('locale-map');
  if (!el) return;

  // Soft-nav can reuse a host that already had a Map instance; replace the node.
  const fresh = el.cloneNode(false);
  el.replaceWith(fresh);
  el = fresh;

  const bootId = ++localeMapBootId;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;

  if (!key || !mapId) {
    el.textContent = 'Missing PUBLIC_GOOGLE_MAPS_BROWSER_KEY or PUBLIC_GOOGLE_MAPS_MAP_ID';
    return;
  }

  let map = null;
  let circle = null;
  let pinHover = null;
  let title = el.dataset.title || 'Locale';
  const listings = parseListings(el.dataset.listings);

  const ensureMap = async (lat, lng, radiusM) => {
    if (map) return;
    await loadGoogleMaps(key);
    if (bootId !== localeMapBootId || !document.getElementById('locale-map')) return;

    el.replaceChildren();
    const { Map, InfoWindow } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
    if (bootId !== localeMapBootId) return;

    const position = { lat, lng };
    map = new Map(el, {
      center: position,
      zoom: 10,
      mapId,
    });
    circle = new google.maps.Circle({
      map,
      center: position,
      radius: radiusM,
      strokeColor: '#1a73e8',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#1a73e8',
      fillOpacity: 0.12,
    });

    pinHover = createPinHoverController(map, InfoWindow);

    for (const listing of listings) {
      if (typeof listing.lat !== 'number' || typeof listing.lng !== 'number') continue;
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'locale-map__listing-pin';
      pin.title = listing.name || 'Listing';
      pin.setAttribute('aria-label', listing.name || 'Listing');
      pin.addEventListener('click', (e) => {
        e.preventDefault();
        if (!listing.id) return;
        const match = location.pathname.match(/^(\/app\/locales\/[^/]+)/);
        if (match) location.href = `${match[1]}/listings/${listing.id}`;
      });
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: listing.lat, lng: listing.lng },
        title: listing.name || 'Listing',
        content: pin,
      });
      pinHover.bind(marker, pin, listing);
    }
  };

  /** Frame the locale radius. Do not expand to out-of-radius pins (that shrinks the circle). */
  const fit = () => {
    if (!map) return;
    if (circle) {
      const circleBounds = circle.getBounds();
      if (circleBounds && !circleBounds.isEmpty()) {
        const div = map.getDiv?.();
        const h = Math.max(div?.clientHeight || 0, 240);
        map.fitBounds(circleBounds, {
          top: Math.round(h * 0.1),
          right: 40,
          bottom: Math.round(h * 0.08),
          left: 40,
        });
        return;
      }
    }
    const bounds = new google.maps.LatLngBounds();
    for (const listing of listings) {
      if (typeof listing.lat === 'number' && typeof listing.lng === 'number') {
        bounds.extend({ lat: listing.lat, lng: listing.lng });
      }
    }
    if (!bounds.isEmpty()) fitMapForPinTooltips(map, bounds);
  };

  const setView = async ({ lat, lng, radiusM, title: nextTitle }) => {
    if (typeof nextTitle === 'string' && nextTitle) {
      title = nextTitle;
    }
    const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
    const nextRadius =
      typeof radiusM === 'number' && radiusM > 0 ? radiusM : milesToMeters(10);

    if (hasCenter) {
      await ensureMap(lat, lng, nextRadius);
      if (bootId !== localeMapBootId || !map || !circle) return;
      const pos = { lat, lng };
      map.setCenter(pos);
      circle.setCenter(pos);
      circle.setRadius(nextRadius);
      fit();
      return;
    }

    if (map && circle && typeof radiusM === 'number' && radiusM > 0) {
      circle.setRadius(radiusM);
      fit();
    }
  };

  el.__localeMap = { setView };

  el.addEventListener('locale-map:update', (event) => {
    setView(event.detail ?? {}).catch((err) => {
      el.textContent = err instanceof Error ? err.message : 'Map failed';
    });
  });

  const parseCoord = (raw) => {
    if (raw == null || raw === '') return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const initialLat = parseCoord(el.dataset.lat);
  const initialLng = parseCoord(el.dataset.lng);
  let initialRadius = Number(el.dataset.radiusM);
  if (!Number.isFinite(initialRadius) || initialRadius <= 0) {
    initialRadius = milesToMeters(10);
  }

  const nudgeMapLayout = () => {
    if (!map) return;
    google.maps.event.trigger(map, 'resize');
    fit();
  };

  if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
    await setView({
      lat: initialLat,
      lng: initialLng,
      radiusM: initialRadius,
      title,
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(nudgeMapLayout);
    });
  } else {
    el.textContent = 'Enter a place name to preview the map.';
  }
}

function bootLocaleMap() {
  const el = document.getElementById('locale-map');
  if (!el) return;

  whenMapVisible(el, () => {
    initLocaleMap().catch((err) => {
      const host = document.getElementById('locale-map');
      if (host) host.textContent = err instanceof Error ? err.message : 'Map failed';
    });
  });
}

document.addEventListener('astro:page-load', bootLocaleMap);
bootLocaleMap();
