/**
 * Month popover for tour week date jump — shows dots on scheduled tour dates.
 * Native <input type="date"> pickers cannot mark dates.
 */

function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toDateKey(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function markedSet(root) {
  const raw = root.getAttribute('data-tour-marked-dates') || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * @param {ParentNode} weekRoot
 * @param {{ onSelectDate: (iso: string) => void, signal?: AbortSignal }} opts
 */
export function bindTourWeekJumpPopover(weekRoot, opts) {
  const jumpBtn = weekRoot.querySelector('[data-tour-week-jump]');
  const popover = weekRoot.querySelector('[data-tour-week-jump-popover]');
  const grid = weekRoot.querySelector('[data-jump-month-grid]');
  const labelEl = weekRoot.querySelector('[data-jump-month-label]');
  const prevBtn = weekRoot.querySelector('[data-jump-month-prev]');
  const nextBtn = weekRoot.querySelector('[data-jump-month-next]');
  if (
    !(jumpBtn instanceof HTMLElement) ||
    !(popover instanceof HTMLElement) ||
    !(grid instanceof HTMLElement) ||
    !(labelEl instanceof HTMLElement)
  ) {
    return;
  }

  const signal = opts.signal;
  let view = parseDateKey(weekRoot.querySelector('[data-tour-date].is-selected')?.getAttribute('data-tour-date')
    || weekRoot.querySelector('[data-tour-date]')?.getAttribute('data-tour-date')
    || '') || new Date();
  view = new Date(view.getFullYear(), view.getMonth(), 1);

  function close() {
    popover.hidden = true;
    jumpBtn.setAttribute('aria-expanded', 'false');
  }

  function open() {
    popover.hidden = false;
    jumpBtn.setAttribute('aria-expanded', 'true');
    render();
  }

  function render() {
    const marked = markedSet(weekRoot);
    labelEl.textContent = monthLabel(view);
    grid.replaceChildren();

    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (const w of weekdays) {
      const head = document.createElement('span');
      head.className = 'tour-week__jump-dow';
      head.textContent = w;
      head.setAttribute('aria-hidden', 'true');
      grid.appendChild(head);
    }

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

    for (let i = 0; i < startPad; i++) {
      const pad = document.createElement('span');
      pad.className = 'tour-week__jump-day tour-week__jump-day--pad';
      pad.setAttribute('aria-hidden', 'true');
      grid.appendChild(pad);
    }

    const todayKey = toDateKey(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(view.getFullYear(), view.getMonth(), day);
      const key = toDateKey(date);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tour-week__jump-day';
      btn.dataset.jumpDate = key;
      if (key === todayKey) btn.classList.add('is-today');
      if (marked.has(key)) btn.classList.add('has-tour');
      btn.setAttribute(
        'aria-label',
        marked.has(key) ? `${key}, tour scheduled` : key,
      );

      const num = document.createElement('span');
      num.className = 'tour-week__jump-daynum';
      num.textContent = String(day);
      btn.appendChild(num);

      const dot = document.createElement('span');
      dot.className = marked.has(key)
        ? 'tour-week__jump-dot'
        : 'tour-week__jump-dot tour-week__jump-dot--empty';
      dot.setAttribute('aria-hidden', 'true');
      btn.appendChild(dot);

      grid.appendChild(btn);
    }
  }

  jumpBtn.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (popover.hidden) open();
      else close();
    },
    { signal },
  );

  prevBtn?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      render();
    },
    { signal },
  );

  nextBtn?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      render();
    },
    { signal },
  );

  grid.addEventListener(
    'click',
    (e) => {
      const btn = e.target instanceof Element
        ? e.target.closest('[data-jump-date]')
        : null;
      if (!(btn instanceof HTMLElement)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.jumpDate;
      if (!key) return;
      close();
      opts.onSelectDate(key);
    },
    { signal },
  );

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (popover.hidden) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (popover.contains(t) || jumpBtn.contains(t)) return;
      close();
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && !popover.hidden) close();
    },
    { signal },
  );
}
