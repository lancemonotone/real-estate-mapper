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

async function initLocaleMap() {
  const el = document.getElementById('locale-map');
  if (!el) return;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;

  if (!key || !mapId) {
    el.textContent = 'Missing PUBLIC_GOOGLE_MAPS_BROWSER_KEY or PUBLIC_GOOGLE_MAPS_MAP_ID';
    return;
  }

  let map = null;
  let marker = null;
  let circle = null;
  let title = el.dataset.title || 'Locale';

  const ensureMap = async (lat, lng, radiusM) => {
    if (map) return;
    await loadGoogleMaps(key);
    el.textContent = '';
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
    const position = { lat, lng };
    map = new Map(el, {
      center: position,
      zoom: 10,
      mapId,
    });
    marker = new AdvancedMarkerElement({ map, position, title });
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
  };

  const fit = () => {
    if (!circle) return;
    const bounds = circle.getBounds();
    if (bounds) map.fitBounds(bounds);
  };

  const setView = async ({ lat, lng, radiusM, title: nextTitle }) => {
    if (typeof nextTitle === 'string' && nextTitle) {
      title = nextTitle;
      if (marker) marker.title = title;
    }
    const hasCenter = typeof lat === 'number' && typeof lng === 'number';
    const nextRadius =
      typeof radiusM === 'number' && radiusM > 0 ? radiusM : milesToMeters(10);

    if (hasCenter) {
      await ensureMap(lat, lng, nextRadius);
      const pos = { lat, lng };
      map.setCenter(pos);
      marker.position = pos;
      circle.setCenter(pos);
      circle.setRadius(nextRadius);
      fit();
      return;
    }

    if (map && typeof radiusM === 'number' && radiusM > 0) {
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

  const initialLat = Number(el.dataset.lat);
  const initialLng = Number(el.dataset.lng);
  let initialRadius = Number(el.dataset.radiusM);
  if (!Number.isFinite(initialRadius) || initialRadius <= 0) {
    initialRadius = milesToMeters(10);
  }

  if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
    await setView({
      lat: initialLat,
      lng: initialLng,
      radiusM: initialRadius,
      title,
    });
  } else {
    el.textContent = 'Enter a place name to preview the map.';
  }
}

initLocaleMap().catch((err) => {
  const el = document.getElementById('locale-map');
  if (el) el.textContent = err instanceof Error ? err.message : 'Map failed';
});
