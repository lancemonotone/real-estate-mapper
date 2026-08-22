async function initTourMap() {
  const el = document.getElementById('tour-map');
  if (!el) return;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;
  const stops = JSON.parse(el.dataset.stops || '[]');
  const encodedPolyline = el.dataset.polyline || '';

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

  const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] =
    await Promise.all([
      google.maps.importLibrary('maps'),
      google.maps.importLibrary('marker'),
    ]);

  const map = new Map(el, {
    center: { lat: stops[0].lat, lng: stops[0].lng },
    zoom: 11,
    mapId,
  });

  const infoWindow = new InfoWindow({ maxWidth: 280 });

  function buildInfoContent(stop) {
    const wrap = document.createElement('div');
    wrap.className = 'tour-pin-info';
    wrap.style.cssText =
      'font: 14px/1.4 system-ui, sans-serif; color: #202124; max-width: 260px;';

    if (stop.photoUrl) {
      const img = document.createElement('img');
      img.src = stop.photoUrl;
      img.alt = '';
      img.style.cssText =
        'display:block;width:100%;height:auto;max-height:160px;object-fit:cover;border-radius:6px;margin-bottom:8px;';
      wrap.appendChild(img);
    }

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:4px;';
    title.textContent = stop.name || 'Listing';
    wrap.appendChild(title);

    if (stop.address) {
      const addr = document.createElement('div');
      addr.style.cssText = 'color:#5f6368;font-size:13px;margin-bottom:4px;';
      addr.textContent = stop.address;
      wrap.appendChild(addr);
    }

    if (stop.isStart) {
      const badge = document.createElement('div');
      badge.style.cssText = 'color:#1a73e8;font-size:12px;font-weight:600;';
      badge.textContent = 'Start';
      wrap.appendChild(badge);
    } else if (stop.legDurationSec != null) {
      const eta = document.createElement('div');
      eta.style.cssText = 'color:#5f6368;font-size:12px;';
      eta.textContent = `Next leg ~${Math.round(stop.legDurationSec / 60)} min`;
      wrap.appendChild(eta);
    }

    return wrap;
  }

  const bounds = new google.maps.LatLngBounds();
  for (const [index, stop] of stops.entries()) {
    const position = { lat: stop.lat, lng: stop.lng };
    bounds.extend(position);

    const glyph = stop.isStart
      ? 'S'
      : stop.sortOrder != null
        ? String(stop.sortOrder + 1)
        : String(index + 1);

    const pin = new PinElement({
      glyph,
      glyphColor: '#ffffff',
      background: stop.isStart ? '#1a73e8' : '#ea4335',
      borderColor: stop.isStart ? '#174ea6' : '#b31412',
      scale: 1.1,
    });

    const marker = new AdvancedMarkerElement({
      map,
      position,
      title: stop.name,
      content: pin.element,
      gmpClickable: true,
    });

    marker.addEventListener('gmp-click', () => {
      infoWindow.close();
      infoWindow.setHeaderContent(stop.isStart ? 'Start' : `Stop ${glyph}`);
      infoWindow.setContent(buildInfoContent(stop));
      infoWindow.open({ anchor: marker, map });
    });
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
