/**
 * Listing page “add to tour” week calendar — always merge, no conflict dialog.
 */
import { bindTourWeekJumpPopover } from './tour-week-jump-popover.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function dayNum(key) {
  const parts = key.split('-');
  return String(Number(parts[2] ?? '0'));
}

function renderWeekCell(key, index, cal) {
  const meta = cal.daysByDate[key];
  const selected = cal.selectedDate === key;
  const hasTour = Boolean(meta && meta.stopCount > 0);
  const dropBlockedReason =
    cal.dropBlocked[key] ?? (!hasTour && cal.blockNewTourDays ? 'cap' : undefined);
  const classes = ['tour-week__cell'];
  if (selected) classes.push('is-selected');
  if (hasTour) classes.push('has-tour');
  if (dropBlockedReason === 'cap') classes.push('tour-week__cell--drop-blocked');
  if (dropBlockedReason === 'hidden') classes.push('tour-week__cell--drop-hidden');

  const ariaLabel = `${WEEKDAY_LABELS[index]} ${key}${
    hasTour ? `, ${meta.stopCount} stops` : ''
  }${dropBlockedReason === 'cap' ? ', tour day limit reached' : ''}${
    dropBlockedReason === 'hidden' ? ', hidden on Free plan' : ''
  }`;

  const dot = hasTour
    ? `<span class="tour-week__dot" data-tour-day-dot>${meta.stopCount}</span>`
    : '<span class="tour-week__dot tour-week__dot--empty" aria-hidden="true"></span>';

  return `<button
    type="button"
    class="${classes.join(' ')}"
    role="gridcell"
    data-tour-date="${key}"
    data-tour-day-id="${meta?.id ?? ''}"
    data-stop-count="${meta?.stopCount ?? 0}"
    ${dropBlockedReason ? `data-drop-blocked="${dropBlockedReason}"` : ''}
    aria-pressed="${selected ? 'true' : 'false'}"
    ${dropBlockedReason ? 'aria-disabled="true"' : ''}
    aria-label="${ariaLabel}"
  >
    <span class="tour-week__weekday">${WEEKDAY_LABELS[index]}</span>
    <span class="tour-week__daynum">${dayNum(key)}</span>
    ${dot}
  </button>`;
}

function patchTourWeekCalendar(cal) {
  const root = document.querySelector('[data-listing-tour-calendar] [data-tour-week]');
  if (!root || !cal) return;

  const labelBtn = root.querySelector('[data-tour-week-jump]');
  if (labelBtn) labelBtn.textContent = cal.weekLabel;

  const jumpInput = root.querySelector('[data-tour-week-jump-input]');
  if (jumpInput instanceof HTMLInputElement) jumpInput.value = cal.selectedDate;

  const markedDates = Object.entries(cal.daysByDate)
    .filter(([, meta]) => meta.stopCount > 0)
    .map(([key]) => key)
    .join(',');
  root.dataset.tourMarkedDates = markedDates;

  const grid = root.querySelector('.tour-week__grid');
  if (grid) {
    grid.innerHTML = cal.weekKeys
      .map((key, index) => renderWeekCell(key, index, cal))
      .join('');
  }
}

async function selectTourDay(day, { openTour = false } = {}) {
  const cfg = seed();
  if (!cfg?.listingPath || !day) return;

  cfg.selectedDate = day;

  const url = new URL(cfg.listingPath, window.location.origin);
  url.searchParams.set('tourDay', day);
  url.searchParams.delete('openTour');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);

  await window.__WAYHOME_REFRESH_LISTING_SURFACE__?.({ tourDay: day });

  if (openTour) {
    window.__WAYHOME_LISTING_OVERLAY__?.open?.('tour');
  }
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
  void selectTourDay(key);
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

async function unassignFromTour(form) {
  const cfg = seed();
  const body = new FormData(form);
  if (!body.get('return_to') && cfg?.listingPath) {
    body.set('return_to', cfg.listingPath);
  }
  const res = await fetch('/api/tours/unassign', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Remove failed');
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
    const url = new URL(window.location.href);
    url.searchParams.delete('openTour');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  root.querySelector('[data-tour-week-prev]')?.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const weekRoot = root.querySelector('[data-tour-week]');
      if (weekRoot) weekShift(weekRoot, -1);
    },
    { signal },
  );
  root.querySelector('[data-tour-week-next]')?.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const weekRoot = root.querySelector('[data-tour-week]');
      if (weekRoot) weekShift(weekRoot, 1);
    },
    { signal },
  );

  const jumpInput = root.querySelector('[data-tour-week-jump-input]');
  const weekRoot = root.querySelector('[data-tour-week]');
  if (weekRoot) {
    bindTourWeekJumpPopover(weekRoot, {
      signal,
      onSelectDate: (day) => {
        void selectTourDay(day);
      },
    });
  }
  jumpInput?.addEventListener(
    'change',
    () => {
      if (!(jumpInput instanceof HTMLInputElement) || !jumpInput.value) return;
      void selectTourDay(jumpInput.value);
    },
    { signal },
  );

  root.querySelector('[data-tour-week-info]')?.setAttribute('hidden', '');

  root.addEventListener(
    'click',
    (event) => {
      const cell = event.target.closest('[data-tour-date]');
      if (!cell || !root.contains(cell)) return;
      event.preventDefault();
      const tourDate = cell.getAttribute('data-tour-date');
      if (!tourDate || tourDate === cfg.selectedDate) return;
      void selectTourDay(tourDate);
    },
    { signal },
  );

  root.addEventListener(
    'click',
    async (event) => {
      const btn = event.target.closest('[data-listing-tour-add]');
      if (!btn || !root.contains(btn)) return;
      if (btn instanceof HTMLButtonElement && btn.disabled) return;
      const tourDate = cfg.selectedDate;
      if (!tourDate) {
        showStatus('Select a day first');
        return;
      }
      showStatus('');
      try {
        await assignToDay(tourDate);
        await window.__WAYHOME_REFRESH_LISTING_SURFACE__?.({ tourDay: tourDate });
      } catch (e) {
        showStatus(e instanceof Error ? e.message : 'Could not add to tour');
      }
    },
    { signal },
  );

  document.addEventListener(
    'submit',
    async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.matches('[data-listing-tour-unassign]')) return;
      event.preventDefault();
      try {
        await unassignFromTour(form);
        const tourDay = cfg.selectedDate;
        await window.__WAYHOME_REFRESH_LISTING_SURFACE__?.({ tourDay });
      } catch (e) {
        showStatus(e instanceof Error ? e.message : 'Could not remove from tour');
      }
    },
    { signal },
  );
}

document.addEventListener('wayhome:listing-surface-applied', (event) => {
  const surface = event.detail?.surface;
  if (!surface?.tour?.calendar) return;
  patchTourWeekCalendar(surface.tour.calendar);
  boot();
});

document.addEventListener('astro:page-load', boot);
boot();
