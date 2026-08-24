import { createPinHoverController } from './map-pin-hover.js';

function parseJsonAttr(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function initTourMap() {
  const el = document.getElementById('tour-map');
  if (!el) return;

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

  const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] =
    await Promise.all([
      google.maps.importLibrary('maps'),
      google.maps.importLibrary('marker'),
    ]);

  const center = stops[0]
    ? { lat: stops[0].lat, lng: stops[0].lng }
    : customStart
      ? { lat: customStart.lat, lng: customStart.lng }
      : { lat: customEnd.lat, lng: customEnd.lng };

  const map = new Map(el, {
    center,
    zoom: 11,
    mapId,
  });

  const pinHover = createPinHoverController(map, InfoWindow);
  const bounds = new google.maps.LatLngBounds();

  function addMarker(stop, glyph, background, borderColor, header) {
    const position = { lat: stop.lat, lng: stop.lng };
    bounds.extend(position);

    const pin = new PinElement({
      glyph,
      glyphColor: '#ffffff',
      background,
      borderColor,
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
        name: 'Custom start',
        address: customStart.address || '',
        lat: customStart.lat,
        lng: customStart.lng,
        kind: 'custom-start',
      },
      'S',
      '#1a73e8',
      '#174ea6',
      'Custom start',
    );
  }

  for (const [index, stop] of stops.entries()) {
    const isPropertyStart = !customStart && stop.isStart;
    const glyph = isPropertyStart
      ? 'S'
      : stop.sortOrder != null
        ? String(stop.sortOrder + 1)
        : String(index + 1);
    addMarker(
      stop,
      glyph,
      isPropertyStart ? '#1a73e8' : '#ea4335',
      isPropertyStart ? '#174ea6' : '#b31412',
      isPropertyStart ? 'Start' : `Stop ${glyph}`,
    );
  }

  if (customEnd) {
    addMarker(
      {
        id: 'custom-end',
        name: 'Custom end',
        address: customEnd.address || '',
        lat: customEnd.lat,
        lng: customEnd.lng,
        kind: 'custom-end',
      },
      'E',
      '#188038',
      '#0d652d',
      'Custom end',
    );
  }

  if (encodedPolyline) {
    const { encoding } = await google.maps.importLibrary('geometry');
    const path = encoding.decodePath(encodedPolyline);
    new google.maps.Polyline({
      path,
      map,
      strokeColor: '#1a73e8',
      strokeOpacity: 0.9,
      strokeWeight: 5,
    });
    for (const point of path) {
      bounds.extend(point);
    }
  }

  map.fitBounds(bounds);
}

initTourMap().catch((err) => {
  const el = document.getElementById('tour-map');
  if (el) el.textContent = err instanceof Error ? err.message : 'Map failed';
});
