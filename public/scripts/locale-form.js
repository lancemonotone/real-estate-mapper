/**
 * New / Edit Locale form: place preview + save.
 * Map rendering lives in locale-map.js (listens for locale-map:update).
 */

function milesToMeters(m) {
  return m * 1609.344;
}

function readListingPrefs(formData) {
  return {
    target_beds: Number(formData.get('target_beds')),
    pets: {
      cats: Number(formData.get('pet_cats')),
      dogs: Number(formData.get('pet_dogs')),
    },
  };
}

function bootLocaleForm() {
  const form = document.getElementById('locale-form');
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.localeFormBound === 'true') return;
  form.dataset.localeFormBound = 'true';

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
    const mapHost = document.getElementById('locale-map');
    mapHost?.dispatchEvent(new CustomEvent('locale-map:update', { detail }));
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

  if (cfg.createBlocked && errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = cfg.blockedMessage || 'Locale limit reached.';
    errorEl.classList.add('is-plan-limit');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cfg.createBlocked) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = cfg.blockedMessage || 'Locale limit reached.';
        errorEl.classList.add('is-plan-limit');
      }
      return;
    }
    const fd = new FormData(form);
    const mode = cfg.mode === 'edit' ? 'edit' : 'create';
    const listing_prefs = readListingPrefs(fd);
    let body;
    let url;
    if (mode === 'edit') {
      const place = String(fd.get('place') ?? '').trim();
      body = {
        id: cfg.localeId,
        name: String(fd.get('name') ?? ''),
        radius_miles: Number(fd.get('radius_miles')),
        listing_prefs,
        ...(place ? { place } : {}),
      };
      url = '/api/locales/update';
    } else {
      body = {
        name: String(fd.get('name') ?? ''),
        place: String(fd.get('place') ?? ''),
        radius_miles: Number(fd.get('radius_miles')),
        listing_prefs,
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
        errorEl.classList.toggle('is-plan-limit', data.code === 'plan_limit');
      }
      return;
    }
    if (mode === 'edit') {
      window.location.href = cfg.base || '/app';
    } else {
      window.location.href = `/app/locales/${data.id}`;
    }
  });

  const deleteBtn = document.getElementById('locale-delete');
  if (cfg.mode === 'edit' && deleteBtn instanceof HTMLButtonElement && cfg.localeId) {
    deleteBtn.addEventListener('click', async () => {
      const name = cfg.localeName || 'this Locale';
      const ok = window.confirm(
        `Delete "${name}"? This permanently removes all listings, tours, and travel data in this Locale.`,
      );
      if (!ok) return;

      deleteBtn.disabled = true;
      const res = await fetch(
        `/api/locales/delete?id=${encodeURIComponent(cfg.localeId)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) {
        deleteBtn.disabled = false;
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = data.error ?? 'Delete failed';
        }
        return;
      }
      window.location.href = '/app';
    });
  }
}

document.addEventListener('astro:page-load', bootLocaleForm);
bootLocaleForm();
