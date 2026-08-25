/**
 * New / Edit Locale form: place preview + save.
 * Map rendering lives in locale-map.js (listens for locale-map:update).
 */

function milesToMeters(m) {
  return m * 1609.344;
}

function bootLocaleForm() {
  const form = document.getElementById('locale-form');
  if (!(form instanceof HTMLFormElement)) return;

  const errorEl = document.getElementById('error');
  const placeEl = document.getElementById('locale-place');
  const radiusEl = document.getElementById('locale-radius');
  const nameEl = document.getElementById('locale-name');
  const mapEl = document.getElementById('locale-map');
  const hintEl = document.getElementById('map-hint');
  const cfg = window.__WAYHOME_LOCALE_FORM__ || {};

  let previewTimer = null;
  let lastCenter =
    cfg.initialHasCenter && mapEl
      ? {
          lat: Number(mapEl.dataset.lat),
          lng: Number(mapEl.dataset.lng),
        }
      : null;

  if (
    lastCenter &&
    (!Number.isFinite(lastCenter.lat) || !Number.isFinite(lastCenter.lng))
  ) {
    lastCenter = null;
  }

  function pushMapUpdate(detail) {
    mapEl?.dispatchEvent(new CustomEvent('locale-map:update', { detail }));
  }

  async function previewPlace() {
    const place = placeEl instanceof HTMLInputElement ? placeEl.value.trim() : '';
    if (!place) return;
    const res = await fetch('/api/locales/preview-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (hintEl) hintEl.textContent = data.error ?? 'Place not found';
      return;
    }
    lastCenter = { lat: data.lat, lng: data.lng };
    const miles =
      radiusEl instanceof HTMLSelectElement ? Number(radiusEl.value) : 10;
    const title =
      nameEl instanceof HTMLInputElement && nameEl.value.trim()
        ? nameEl.value.trim()
        : data.formattedAddress;
    if (hintEl) hintEl.textContent = data.formattedAddress;
    pushMapUpdate({
      lat: data.lat,
      lng: data.lng,
      radiusM: milesToMeters(miles),
      title,
    });
  }

  placeEl?.addEventListener('input', () => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewPlace().catch(() => {});
    }, 450);
  });

  radiusEl?.addEventListener('change', () => {
    const miles = Number(radiusEl.value);
    if (!lastCenter) {
      pushMapUpdate({ radiusM: milesToMeters(miles) });
      return;
    }
    pushMapUpdate({
      lat: lastCenter.lat,
      lng: lastCenter.lng,
      radiusM: milesToMeters(miles),
    });
  });

  nameEl?.addEventListener('input', () => {
    const title =
      nameEl instanceof HTMLInputElement && nameEl.value.trim()
        ? nameEl.value.trim()
        : 'Locale';
    pushMapUpdate({ title });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const mode = cfg.mode === 'edit' ? 'edit' : 'create';
    let body;
    let url;
    if (mode === 'edit') {
      const place = String(fd.get('place') ?? '').trim();
      body = {
        id: cfg.localeId,
        name: String(fd.get('name') ?? ''),
        radius_miles: Number(fd.get('radius_miles')),
        ...(place ? { place } : {}),
      };
      url = '/api/locales/update';
    } else {
      body = {
        name: String(fd.get('name') ?? ''),
        place: String(fd.get('place') ?? ''),
        radius_miles: Number(fd.get('radius_miles')),
      };
      url = '/api/locales/create';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = data.error ?? 'Save failed';
      }
      return;
    }
    if (mode === 'edit') {
      window.location.href = cfg.base || '/app';
    } else {
      window.location.href = `/app/locales/${data.id}`;
    }
  });
}

document.addEventListener('astro:page-load', bootLocaleForm);
