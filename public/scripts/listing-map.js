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
  if (!el) return;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;
  const lat = Number(el.dataset.lat);
  const lng = Number(el.dataset.lng);
  const title = el.dataset.title || 'Listing';
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

  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  const position = { lat, lng };
  const map = new Map(el, {
    center: position,
    zoom: 15,
    mapId,
  });

  const content = document.createElement('div');
  content.className = 'listing-map-marker';
  const label = document.createElement('div');
  label.textContent = title;
  content.appendChild(label);
  if (photoUrl) {
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = '';
    content.appendChild(img);
  }

  new AdvancedMarkerElement({ map, position, title, content });
}

initListingMap().catch((err) => {
  const el = document.getElementById('listing-map');
  if (el) el.textContent = err instanceof Error ? err.message : 'Map failed';
});
