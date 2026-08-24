function openPlanRouteOverlay() {
  const overlay = document.getElementById('tour-plan-route-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  document.body.classList.add('compare-column-overlay-open');
}

function closePlanRouteOverlay() {
  const overlay = document.getElementById('tour-plan-route-overlay');
  if (!(overlay instanceof HTMLElement)) return;
  overlay.hidden = true;
  document.body.classList.remove('compare-column-overlay-open');
}

function setStatus(message) {
  const status = document.getElementById('plan-route-status');
  if (!(status instanceof HTMLElement)) return;
  if (!message) {
    status.hidden = true;
    status.textContent = '';
    return;
  }
  status.hidden = false;
  status.textContent = message;
}

function syncClearable(wrap) {
  const input = wrap.querySelector('[data-clearable-input]');
  const clearBtn = wrap.querySelector('[data-clearable-clear]');
  const flag = wrap.querySelector('[data-clearable-flag]');
  if (!(input instanceof HTMLInputElement) || !(clearBtn instanceof HTMLElement)) return;

  const hasValue = input.value.trim().length > 0;
  clearBtn.hidden = !hasValue;

  if (flag instanceof HTMLInputElement) {
    const hadSaved = input.dataset.hadSaved === '1';
    if (!hasValue && hadSaved) flag.value = '1';
    else if (hasValue) flag.value = '';
  }
}

function initClearableFields(root, signal) {
  root.querySelectorAll('.field-clearable').forEach((wrap) => {
    if (!(wrap instanceof HTMLElement)) return;
    const input = wrap.querySelector('[data-clearable-input]');
    const clearBtn = wrap.querySelector('[data-clearable-clear]');
    if (!(input instanceof HTMLInputElement) || !(clearBtn instanceof HTMLElement)) return;

    const refresh = () => syncClearable(wrap);
    input.addEventListener('input', refresh, { signal });
    clearBtn.addEventListener(
      'click',
      () => {
        input.value = '';
        refresh();
        input.focus();
      },
      { signal },
    );
    refresh();
  });
}

function initTourDay() {
  const overlay = document.getElementById('tour-plan-route-overlay');
  const form = document.querySelector('[data-tour-plan-route-form]');
  const tourId = window.__WAYHOME_TOUR_DAY__?.tourId;
  if (!(overlay instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !tourId) return;

  if (overlay._tourDayAbort instanceof AbortController) {
    overlay._tourDayAbort.abort();
  }
  const ac = new AbortController();
  overlay._tourDayAbort = ac;
  const { signal } = ac;

  document.querySelectorAll('[data-tour-plan-route-open]').forEach((el) => {
    el.addEventListener('click', () => openPlanRouteOverlay(), { signal });
  });
  overlay.querySelectorAll('[data-tour-plan-route-close]').forEach((el) => {
    el.addEventListener('click', () => closePlanRouteOverlay(), { signal });
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closePlanRouteOverlay();
    },
    { signal },
  );

  initClearableFields(form, signal);

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      setStatus('');
      const goBtn = form.querySelector('button[type="submit"]');
      if (goBtn instanceof HTMLButtonElement) goBtn.disabled = true;

      try {
        const endpointsRes = await fetch('/api/tours/endpoints', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        if (!endpointsRes.ok) {
          const text = await endpointsRes.text();
          setStatus(text || 'Could not save start / end.');
          closePlanRouteOverlay();
          return;
        }

        const optimizeRes = await fetch('/api/tours/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourDayId: tourId }),
        });
        const data = await optimizeRes.json().catch(() => ({}));
        if (!data.ok) {
          setStatus(data.error || 'Route optimize failed.');
          closePlanRouteOverlay();
          return;
        }
        location.reload();
      } finally {
        if (goBtn instanceof HTMLButtonElement) goBtn.disabled = false;
      }
    },
    { signal },
  );
}

initTourDay();
document.addEventListener('astro:page-load', initTourDay);
