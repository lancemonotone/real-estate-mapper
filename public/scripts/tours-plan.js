function getConfig() {
  const cfg = window.__WAYHOME_TOURS_PLAN__;
  if (!cfg?.localeId || !cfg?.toursBase) {
    throw new Error('Missing Tours Plan config');
  }
  return cfg;
}

function setError(message) {
  const el = document.getElementById('plan-error');
  if (!(el instanceof HTMLElement)) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function showPreview(result, listingLabels) {
  const box = document.getElementById('plan-result');
  const order = document.getElementById('plan-order');
  const meta = document.getElementById('plan-meta');
  const saveForm = document.getElementById('plan-save-form');
  if (!(box instanceof HTMLElement) || !(order instanceof HTMLElement)) return;

  order.replaceChildren();
  const ids = Array.isArray(result.orderedIds) ? result.orderedIds : [];
  for (const id of ids) {
    const li = document.createElement('li');
    li.textContent = listingLabels[id] || id;
    order.appendChild(li);
  }

  const parts = [];
  if (result.customStart) parts.push(`Start: ${result.customStart}`);
  if (result.customEnd) parts.push(`End: ${result.customEnd}`);
  if (Array.isArray(result.legs) && result.legs.length > 0) {
    parts.push(`${result.legs.length} leg${result.legs.length === 1 ? '' : 's'}`);
  }
  if (meta instanceof HTMLElement) meta.textContent = parts.join(' · ');

  box.hidden = ids.length === 0;
  if (saveForm instanceof HTMLElement) saveForm.hidden = !result.ok;
}

function setAutoHint(message) {
  const el = document.getElementById('auto-plan-hint');
  if (!(el instanceof HTMLElement)) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function renderAutoPlanClusters(data) {
  const box = document.getElementById('auto-plan-result');
  const groupsEl = document.getElementById('auto-plan-groups');
  if (!(box instanceof HTMLElement) || !(groupsEl instanceof HTMLElement)) return;

  groupsEl.replaceChildren();
  const clusters = Array.isArray(data.clusters) ? data.clusters : [];

  for (const cluster of clusters) {
    const article = document.createElement('article');
    article.className = 'tours-plan__auto-group';
    article.dataset.listingIds = JSON.stringify(cluster.listingIds ?? []);

    const title = document.createElement('h4');
    title.className = 'tours-plan__auto-group-title';
    const n = (cluster.listingIds ?? []).length;
    title.textContent = `Day draft ${cluster.index + 1} · ${n} listing${n === 1 ? '' : 's'}`;
    article.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'tours-plan__auto-group-list';
    for (const label of cluster.labels ?? []) {
      const li = document.createElement('li');
      li.textContent = label;
      list.appendChild(li);
    }
    article.appendChild(list);

    const label = document.createElement('label');
    label.textContent = 'Tour date';
    const input = document.createElement('input');
    input.type = 'date';
    input.required = true;
    input.name = `auto-plan-date-${cluster.index}`;
    input.dataset.autoPlanDate = 'true';
    label.appendChild(input);
    article.appendChild(label);

    groupsEl.appendChild(article);
  }

  box.hidden = clusters.length === 0;
}

function openPlanOverlay() {
  const overlay = document.getElementById('tours-plan-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  document.body.classList.add('compare-column-overlay-open');
  if (location.hash !== '#plan') {
    history.replaceState(null, '', `${location.pathname}${location.search}#plan`);
  }
}

function closePlanOverlay() {
  const overlay = document.getElementById('tours-plan-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  overlay.hidden = true;
  document.body.classList.remove('compare-column-overlay-open');
  if (location.hash === '#plan') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}

function initToursPlan() {
  const overlay = document.getElementById('tours-plan-overlay');
  const form = document.querySelector('[data-tours-plan-form]');
  const saveForm = document.querySelector('[data-tours-plan-save]');
  if (!(overlay instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;

  // ClientRouter swaps the page; drop prior listeners before rebinding.
  if (overlay._toursPlanAbort instanceof AbortController) {
    overlay._toursPlanAbort.abort();
  }
  const ac = new AbortController();
  overlay._toursPlanAbort = ac;
  const { signal } = ac;

  let cfg;
  try {
    cfg = getConfig();
  } catch {
    return;
  }

  let lastResult = null;
  let lastAutoPlan = null;

  document.querySelectorAll('[data-tours-plan-open]').forEach((el) => {
    el.addEventListener('click', () => openPlanOverlay(), { signal });
  });
  overlay.querySelectorAll('[data-tours-plan-close]').forEach((el) => {
    el.addEventListener('click', () => closePlanOverlay(), { signal });
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closePlanOverlay();
    },
    { signal },
  );
  if (location.hash === '#plan') openPlanOverlay();

  const autoBtn = overlay.querySelector('[data-tours-auto-plan]');
  if (autoBtn instanceof HTMLElement) {
    autoBtn.addEventListener(
      'click',
      async () => {
      setError('');
      setAutoHint('');
      lastAutoPlan = null;
      renderAutoPlanClusters({ clusters: [] });

      const res = await fetch('/api/tours/auto-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localeId: cfg.localeId }),
      });
      const data = await res.json().catch(() => ({}));
      lastAutoPlan = data;

      if (!data.ok) {
        setError(data.error || 'Auto-plan failed.');
        return;
      }

      const hints = [];
      hints.push(
        `Grouped within ${data.radiusMiles} mi · max ${data.maxPerCluster} per day.`,
      );
      if (data.skippedMissingGeo > 0) {
        hints.push(`${data.skippedMissingGeo} listing(s) skipped (no map location).`);
      }
      setAutoHint(hints.join(' '));
      renderAutoPlanClusters(data);
      },
      { signal },
    );
  }

  const autoSaveBtn = overlay.querySelector('[data-tours-auto-plan-save]');
  if (autoSaveBtn instanceof HTMLElement) {
    autoSaveBtn.addEventListener(
      'click',
      async () => {
      setError('');
      if (!lastAutoPlan?.ok || !Array.isArray(lastAutoPlan.clusters)) {
        setError('Run Auto-plan before saving.');
        return;
      }

      const groupEls = [...document.querySelectorAll('#auto-plan-groups .tours-plan__auto-group')];
      const groups = [];
      for (const [i, el] of groupEls.entries()) {
        if (!(el instanceof HTMLElement)) continue;
        let listingIds = [];
        try {
          listingIds = JSON.parse(el.dataset.listingIds || '[]');
        } catch {
          listingIds = [];
        }
        const dateInput = el.querySelector('input[data-auto-plan-date]');
        const tourDate =
          dateInput instanceof HTMLInputElement ? dateInput.value.trim() : '';
        if (!tourDate) {
          setError(`Pick a tour date for day draft ${i + 1}.`);
          return;
        }
        groups.push({ tourDate, listingIds });
      }

      if (groups.length === 0) {
        setError('No clusters to save.');
        return;
      }

      const res = await fetch('/api/tours/auto-plan-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localeId: cfg.localeId, groups }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        location.href = cfg.toursBase;
        return;
      }
      setError(data.error || 'Save tour days failed.');
      },
      { signal },
    );
  }

  form.addEventListener(
    'submit',
    async (e) => {
    e.preventDefault();
    setError('');
    lastResult = null;

    const ids = [...form.querySelectorAll('input[name="listing"]:checked')]
      .map((el) => (el instanceof HTMLInputElement ? el.value : ''))
      .filter(Boolean);

    if (ids.length === 0) {
      setError('Select at least one listing.');
      showPreview({ ok: false, orderedIds: [] }, cfg.listingLabels || {});
      return;
    }

    const startEl = document.getElementById('plan-start');
    const startListingId = startEl instanceof HTMLSelectElement ? startEl.value : '';
    const startAddrEl = document.getElementById('plan-start-address');
    const endAddrEl = document.getElementById('plan-end-address');
    const customStartAddress =
      startAddrEl instanceof HTMLInputElement ? startAddrEl.value.trim() : '';
    const customEndAddress =
      endAddrEl instanceof HTMLInputElement ? endAddrEl.value.trim() : '';

    const res = await fetch('/api/tours/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scratchListingIds: ids,
        startListingId: customStartAddress ? undefined : startListingId || undefined,
        customStartAddress: customStartAddress || undefined,
        customEndAddress: customEndAddress || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    lastResult = data;
    if (!data.ok) {
      setError(data.error || 'Preview route failed.');
      showPreview({ ok: false, orderedIds: [] }, cfg.listingLabels || {});
      return;
    }
    showPreview(data, cfg.listingLabels || {});
    },
    { signal },
  );

  if (saveForm instanceof HTMLFormElement) {
    saveForm.addEventListener(
      'submit',
      async (e) => {
      e.preventDefault();
      setError('');
      if (!lastResult?.ok) {
        setError('Preview a route before saving.');
        return;
      }
      const tourDate = new FormData(saveForm).get('tourDate');
      const res = await fetch('/api/tours/promote-scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localeId: cfg.localeId,
          tourDate,
          listingIdsInOrder: lastResult.orderedIds,
          startListingId: lastResult.customStart ? null : lastResult.orderedIds[0],
          fullPathIds: lastResult.fullPathIds,
          legs: lastResult.legs,
          encodedPolyline: lastResult.encodedPolyline ?? null,
          customStart: lastResult.customStart,
          customEnd: lastResult.customEnd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        location.href = `${cfg.toursBase}/${data.tourDayId}`;
        return;
      }
      setError(data.error || 'Save as tour day failed.');
      },
      { signal },
    );
  }
}

initToursPlan();
document.addEventListener('astro:page-load', initToursPlan);
