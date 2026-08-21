async function initTourMap() {
  const el = document.getElementById('tour-map');
  if (!el) return;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;
  const stops = JSON.parse(el.dataset.stops || '[]');

  if (!key || !mapId) {
    el.textContent = 'Missing PUBLIC_GOOGLE_MAPS_BROWSER_KEY or PUBLIC_GOOGLE_MAPS_MAP_ID';
    return;
  }
  if (!stops.length) {
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

  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  const map = new Map(el, {
    center: { lat: stops[0].lat, lng: stops[0].lng },
    zoom: 11,
    mapId,
  });

  const bounds = new google.maps.LatLngBounds();
  for (const stop of stops) {
    const position = { lat: stop.lat, lng: stop.lng };
    bounds.extend(position);

    const content = document.createElement('div');
    content.style.cssText =
      'background:#fff;border:1px solid #333;padding:4px;max-width:120px;font:12px sans-serif';
    const label = document.createElement('div');
    label.textContent = `${stop.isStart ? 'S' : stop.sortOrder ?? ''} ${stop.name}`;
    content.appendChild(label);
    if (stop.photoUrl) {
      const img = document.createElement('img');
      img.src = stop.photoUrl;
      img.alt = '';
      img.style.cssText = 'width:100%;height:auto;display:block';
      content.appendChild(img);
    }

    new AdvancedMarkerElement({ map, position, title: stop.name, content });
  }
  map.fitBounds(bounds);
}

initTourMap().catch((err) => {
  const el = document.getElementById('tour-map');
  if (el) el.textContent = err instanceof Error ? err.message : 'Map failed';
});
