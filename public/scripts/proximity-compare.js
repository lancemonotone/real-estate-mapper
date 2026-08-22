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

function directionsUrl(td, result) {
  const originLat = Number(td.dataset.listingLat);
  const originLng = Number(td.dataset.listingLng);
  const mode = td.dataset.travelMode || 'DRIVE';
  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    result.place_lat == null ||
    result.place_lng == null
  ) {
    return result.maps_url || null;
  }

  const params = new URLSearchParams({
    api: '1',
    origin: `${originLat},${originLng}`,
    travelmode: TRAVELMODE[mode] || 'driving',
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

function renderCell(td, result) {
  td.replaceChildren();
  if (!result) {
    const pending = document.createElement('span');
    pending.className = 'cell-pending';
    pending.textContent = 'Computing…';
    td.appendChild(pending);
    return;
  }

  if (result.status === 'ok') {
    const wrap = document.createElement('div');
    wrap.className = 'cell-ok';
    if (result.locked) {
      const lock = document.createElement('div');
      lock.className = 'muted';
      lock.textContent = 'Locked';
      wrap.appendChild(lock);
    }
    const line = document.createElement('div');
    line.textContent = [formatDuration(result.duration_sec), formatMiles(result.distance_m)]
      .filter(Boolean)
      .join(' · ');
    wrap.appendChild(line);
    if (result.place_name) {
      const name = document.createElement('div');
      name.textContent = result.place_name;
      wrap.appendChild(name);
    }

    const href = directionsUrl(td, result);
    const originLat = Number(td.dataset.listingLat);
    const originLng = Number(td.dataset.listingLng);
    const canOverlay =
      Number.isFinite(originLat) &&
      Number.isFinite(originLng) &&
      result.place_lat != null &&
      result.place_lng != null;

    if (canOverlay) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary';
      btn.textContent = 'Show route';
      btn.addEventListener('click', () => {
        const maps = window.__WAYHOME_MAPS__ || {};
        const listingName =
          td.closest('tr')?.querySelector('th')?.textContent?.trim() || 'Listing';
        const durationLabel = [
          formatDuration(result.duration_sec),
          formatMiles(result.distance_m),
        ]
          .filter(Boolean)
          .join(' · ');
        window.openDirectionsOverlay?.({
          origin: { lat: originLat, lng: originLng },
          destination: {
            lat: result.place_lat,
            lng: result.place_lng,
            placeId: result.place_id,
            name: result.place_name,
          },
          travelMode: td.dataset.travelMode || 'DRIVE',
          title: `${listingName} → ${result.place_name || 'Place'}`,
          durationLabel,
          externalUrl: href,
          mapKey: maps.mapKey,
          mapId: maps.mapId,
        });
      });
      wrap.appendChild(btn);
    }

    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Google Maps';
      a.style.marginInlineStart = '0.5rem';
      wrap.appendChild(a);
    }

    if (result.locked) {
      const unlock = document.createElement('button');
      unlock.type = 'button';
      unlock.className = 'secondary';
      unlock.textContent = 'Unlock';
      unlock.addEventListener('click', async () => {
        const res = await fetch('/api/proximity/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: td.dataset.listingId,
            criterion_id: td.dataset.criterionId,
            locked: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Unlock failed');
          return;
        }
        await computeCell(td);
      });
      wrap.appendChild(unlock);
    }

    td.appendChild(wrap);
    td.dataset.status = 'ok';
    return;
  }

  const status = document.createElement('div');
  status.className = 'cell-status';
  status.textContent = result.status;
  td.appendChild(status);
  if (result.error_message) {
    const err = document.createElement('div');
    err.className = 'cell-status';
    err.textContent = result.error_message;
    td.appendChild(err);
  }
  td.dataset.status = result.status;
}

async function computeCell(td) {
  const listingId = td.dataset.listingId;
  const criterionId = td.dataset.criterionId;
  if (!listingId || !criterionId) return;

  renderCell(td, null);
  try {
    const res = await fetch('/api/proximity/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, criterion_id: criterionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      renderCell(td, {
        status: 'error',
        error_message: data.error || `HTTP ${res.status}`,
      });
      return;
    }
    renderCell(td, data.result);
  } catch (e) {
    renderCell(td, {
      status: 'error',
      error_message: e instanceof Error ? e.message : 'Compute failed',
    });
  }
}

function initKindToggle() {
  const kind = document.getElementById('criterion-kind');
  const typeFields = document.getElementById('type-fields');
  const pinFields = document.getElementById('pin-fields');
  if (!(kind instanceof HTMLSelectElement) || !typeFields || !pinFields) return;

  const sync = () => {
    const isPin = kind.value === 'fixed_pin';
    pinFields.hidden = !isPin;
    typeFields.hidden = isPin;
  };
  kind.addEventListener('change', sync);
  sync();
}

function initCriterionForm() {
  const form = document.getElementById('criterion-form');
  const status = document.getElementById('criterion-status');
  const searchRoot = document.getElementById('compare-place-search');
  if (!(form instanceof HTMLFormElement)) return;

  let placeSearch = null;
  if (searchRoot && window.__WAYHOME_LOCALE_ID__) {
    placeSearch = mountPlaceSearch(searchRoot, {
      localeId: window.__WAYHOME_LOCALE_ID__,
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const kind = String(fd.get('kind') || '');
    const body = {
      locale_id: String(fd.get('locale_id') || ''),
      label: String(fd.get('label') || '').trim(),
      kind,
      travel_mode: String(fd.get('travel_mode') || 'DRIVE'),
    };
    if (kind === 'place_type') {
      body.place_type_key = String(fd.get('place_type_key') || '');
    } else {
      const place = placeSearch?.getResolved?.();
      if (!place) {
        if (status) status.textContent = 'Choose a shared place from search first';
        return;
      }
      body.pin_lat = place.lat;
      body.pin_lng = place.lng;
      body.pin_place_id = place.placeId;
      body.pin_name = place.name;
      if (!body.label) body.label = place.name;
    }

    if (status) status.textContent = 'Saving…';
    const res = await fetch('/api/proximity/criteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (status) status.textContent = data.error || 'Failed to add column';
      return;
    }
    location.reload();
  });
}

function initDeleteButtons() {
  document.querySelectorAll('.delete-criterion').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-criterion-id');
      if (!id) return;
      if (!confirm('Delete this Compare column?')) return;
      const res = await fetch(`/api/proximity/criteria?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Delete failed');
        return;
      }
      location.reload();
    });
  });
}

function initRefreshStale() {
  const btn = document.getElementById('refresh-stale');
  const localeId = window.__WAYHOME_LOCALE_ID__;
  if (!btn || !localeId) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    try {
      const res = await fetch('/api/proximity/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale_id: localeId, refresh_stale: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Refresh failed');
        return;
      }
      location.reload();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Refresh stale cells';
    }
  });
}

async function hydrateAndCompute() {
  const cells = [...document.querySelectorAll('td[data-listing-id][data-criterion-id]')];
  for (const td of cells) {
    const seeded = td.querySelector('.seeded');
    if (seeded) {
      try {
        const row = JSON.parse(seeded.textContent || '');
        if (row.status === 'ok') {
          renderCell(td, row);
          continue;
        }
      } catch {
        /* fall through to compute */
      }
    }
    await computeCell(td);
  }
}

initKindToggle();
initCriterionForm();
initDeleteButtons();
initRefreshStale();
hydrateAndCompute();
