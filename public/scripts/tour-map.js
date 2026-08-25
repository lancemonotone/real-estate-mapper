import { createPinHoverController } from './map-pin-hover.js';
import { fitMapForPinTooltips } from './map-fit.js';

function parseJsonAttr(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function themePinPalette() {
  const primary = cssVar('--primary') || '#0d9488';
  const primaryContrast = cssVar('--primary-contrast') || '#ffffff';
  const accent = cssVar('--accent') || '#2563eb';
  const endpointGlyph = cssVar('--bg-0') || '#0b1220';
  return {
    stop: {
      background: primary,
      borderColor: primary,
      glyphColor: primaryContrast,
    },
    endpoint: {
      background: accent,
      borderColor: accent,
      glyphColor: endpointGlyph,
    },
  };
}

/** Single-point and multi-pin fit with room above for InfoWindow tooltips. */
function fitMapToMarkers(map, bounds) {
  fitMapForPinTooltips(map, bounds);
}

let tourMapBootId = 0;

async function initTourMap() {
  let el = document.getElementById('tour-map');
  if (!el) return;

  // Soft-nav can reuse a host that already had a Map instance; replace the node
  // so markers + polyline always rebuild from current data-* attrs.
  const fresh = el.cloneNode(false);
  el.replaceWith(fresh);
  el = fresh;

  const bootId = ++tourMapBootId;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;
  const stops = JSON.parse(el.dataset.stops || '[]');
  const encodedPolyline = el.dataset.polyline || '';
  const customStart = parseJsonAttr(el.dataset.customStart);
  const customEnd = parseJsonAttr(el.dataset.customEnd);

  if (!key || !mapId) {
    el.textContent = 'Missing PUBLIC_GOOGLE_MAPS_BROWSER_KEY or PUBLIC_GOOGLE_MAPS_MAP_ID';
    return;
  }
  if (!stops.length && !customStart && !customEnd) {
    el.textContent = 'No geocoded stops to show';
    return;
  }

  await new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve(undefined);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve(undefined);
    script.onerror = () => reject(new Error('Failed to load Maps JS'));
    document.head.appendChild(script);
  });

  if (bootId !== tourMapBootId || !document.getElementById('tour-map')) return;

  const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] =
    await Promise.all([
      google.maps.importLibrary('maps'),
      google.maps.importLibrary('marker'),
    ]);

  if (bootId !== tourMapBootId) return;

  // Soft-nav / double boot: clear prior map DOM before attaching a new Map.
  el.replaceChildren();

  const center = stops[0]
    ? { lat: stops[0].lat, lng: stops[0].lng }
    : customStart
      ? { lat: customStart.lat, lng: customStart.lng }
      : { lat: customEnd.lat, lng: customEnd.lng };

  const map = new Map(el, {
    center,
    zoom: 14,
    mapId,
  });

  const pinHover = createPinHoverController(map, InfoWindow);
  const bounds = new google.maps.LatLngBounds();
  const palette = themePinPalette();

  function addMarker(stop, glyph, role, header) {
    const position = { lat: stop.lat, lng: stop.lng };
    bounds.extend(position);
    const colors = role === 'stop' ? palette.stop : palette.endpoint;

    const pin = new PinElement({
      glyph,
      glyphColor: colors.glyphColor,
      background: colors.background,
      borderColor: colors.borderColor,
      scale: 1.1,
    });

    const marker = new AdvancedMarkerElement({
      map,
      position,
      title: stop.name,
      content: pin.element,
    });

    pinHover.bind(marker, pin.element, stop, header);
  }

  if (customStart) {
    addMarker(
      {
        id: 'custom-start',
        name: customStart.name || customStart.address || 'Start',
        address: customStart.address || '',
        lat: customStart.lat,
        lng: customStart.lng,
        kind: 'custom-start',
      },
      'S',
      'start',
      customStart.name || 'Start',
    );
  }

  for (const stop of stops) {
    const glyph = stop.glyph || '•';
    const role =
      stop.role === 'start' ? 'start' : stop.role === 'end' ? 'end' : 'stop';
    const header =
      role === 'start' ? 'Start' : role === 'end' ? 'End' : `Stop ${glyph}`;
    addMarker(stop, glyph, role, header);
  }

  if (customEnd) {
    addMarker(
      {
        id: 'custom-end',
        name: customEnd.name || customEnd.address || 'End',
        address: customEnd.address || '',
        lat: customEnd.lat,
        lng: customEnd.lng,
        kind: 'custom-end',
      },
      'E',
      'end',
      customEnd.name || 'End',
    );
  }

  if (encodedPolyline) {
    const { encoding } = await google.maps.importLibrary('geometry');
    const path = encoding.decodePath(encodedPolyline);
    new google.maps.Polyline({
      path,
      map,
      strokeColor: palette.stop.background,
      strokeOpacity: 0.9,
      strokeWeight: 5,
    });
    for (const point of path) {
      bounds.extend(point);
    }
  }

  if (bootId !== tourMapBootId) return;
  fitMapToMarkers(map, bounds);
}

function bootTourMap() {
  initTourMap().catch((err) => {
    const el = document.getElementById('tour-map');
    if (el) el.textContent = err instanceof Error ? err.message : 'Map failed';
  });
}

document.addEventListener('astro:page-load', bootTourMap);
