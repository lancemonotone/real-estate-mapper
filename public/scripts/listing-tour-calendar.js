/**
 * Listing page “add to tour” week calendar — always merge, no conflict dialog.
 */
import { bindTourWeekJumpPopover } from './tour-week-jump-popover.js';

function seed() {
  return window.__WAYHOME_LISTING_TOUR_CAL__ ?? null;
}

function showStatus(message) {
  const el = document.getElementById('listing-tour-status');
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function reloadWithDay(day, openTour = true) {
  const cfg = seed();
  if (!cfg?.listingPath) return;
  const url = new URL(cfg.listingPath, window.location.origin);
  if (day) url.searchParams.set('tourDay', day);
  if (openTour) url.searchParams.set('openTour', '1');
  window.location.assign(url.pathname + url.search);
}

function weekShift(root, deltaWeeks) {
  const first = root.querySelector('[data-tour-date]')?.getAttribute('data-tour-date');
  if (!first) return;
  const [y, m, d] = first.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaWeeks * 7);
  const key = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  reloadWithDay(key);
}

function resolveDropForDate(tourDate) {
  const cfg = seed()?.tourCalendar;
  if (!cfg) return { ok: true };

  const blocked = cfg.dropBlockedByDate?.[tourDate];
  if (blocked) {
    return { ok: false, message: blocked.message };
  }

  const meta = cfg.allDaysByDate?.[tourDate];
  const stopCount = meta?.stopCount ?? 0;
  if (stopCount > 0 && !meta.visible) {
    return { ok: false, message: cfg.hiddenMessage };
  }

  if (stopCount === 0 && !cfg.canAddNewTourDay) {
    return { ok: false, message: cfg.capMessage };
  }

  return { ok: true };
}

async function assignToDay(tourDate) {
  const decision = resolveDropForDate(tourDate);
  if (!decision.ok) {
    throw new Error(decision.message);
  }

  const cfg = seed();
  if (!cfg?.localeId || !cfg?.listingId) throw new Error('Missing listing tour config');
  const res = await fetch('/api/tours/calendar-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      localeId: cfg.localeId,
      action: {
        type: 'assign',
        listingIds: [cfg.listingId],
        tourDate,
        mode: 'merge',
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Assign failed');
  return data;
}

let abort = null;

function boot() {
  abort?.abort();
  abort = new AbortController();
  const { signal } = abort;

  const cfg = seed();
  const root = document.querySelector('[data-listing-tour-calendar]');
  if (!cfg || !root) return;

  root.querySelectorAll('[data-tour-day-dot]').forEach((dot) => {
    dot.removeAttribute('draggable');
    dot.removeAttribute('title');
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('openTour') === '1') {
    window.__WAYHOME_LISTING_OVERLAY__?.open?.('tour');
  }

  root.querySelector('[data-tour-week-prev]')?.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      weekShift(root, -1);
    },
    { signal },
  );
  root.querySelector('[data-tour-week-next]')?.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      weekShift(root, 1);
    },
    { signal },
  );

  const jumpInput = root.querySelector('[data-tour-week-jump-input]');
  const weekRoot = root.querySelector('[data-tour-week]');
  if (weekRoot) {
    bindTourWeekJumpPopover(weekRoot, {
      signal,
      onSelectDate: (day) => reloadWithDay(day),
    });
  }
  jumpInput?.addEventListener(
    'change',
    () => {
      if (!(jumpInput instanceof HTMLInputElement) || !jumpInput.value) return;
      reloadWithDay(jumpInput.value);
    },
    { signal },
  );

  root.querySelector('[data-tour-week-info]')?.setAttribute('hidden', '');

  root.querySelectorAll('[data-tour-date]').forEach((cell) => {
    cell.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        const tourDate = cell.getAttribute('data-tour-date');
        if (!tourDate || tourDate === cfg.selectedDate) return;
        reloadWithDay(tourDate);
      },
      { signal },
    );
  });

  root.querySelector('[data-listing-tour-add]')?.addEventListener(
    'click',
    async () => {
      const btn = root.querySelector('[data-listing-tour-add]');
      if (btn instanceof HTMLButtonElement && btn.disabled) return;
      const tourDate = cfg.selectedDate;
      if (!tourDate) {
        showStatus('Select a day first');
        return;
      }
      showStatus('');
      try {
        await assignToDay(tourDate);
        reloadWithDay(tourDate);
      } catch (e) {
        showStatus(e instanceof Error ? e.message : 'Could not add to tour');
      }
    },
    { signal },
  );
}

document.addEventListener('astro:page-load', boot);
