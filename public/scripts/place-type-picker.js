/**
 * Compact place-type picker (Table A). Opens a short in-flow list downward
 * instead of a native <select> popup that flips upward.
 */

let docCloseBound = false;

function ensureDocumentCloseHandlers() {
  if (docCloseBound) return;
  docCloseBound = true;

  document.addEventListener('click', (e) => {
    for (const root of document.querySelectorAll(
      '[data-place-type-picker].is-open',
    )) {
      if (!(root instanceof HTMLElement)) continue;
      if (e.target instanceof Node && root.contains(e.target)) continue;
      closePicker(root);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('[data-place-type-picker].is-open');
    if (!(open instanceof HTMLElement)) return;
    e.preventDefault();
    closePicker(open);
    const trigger = open.querySelector('[data-place-type-trigger]');
    if (trigger instanceof HTMLElement) trigger.focus();
  });
}

function closePicker(root) {
  const panel = root.querySelector('[data-place-type-panel]');
  const trigger = root.querySelector('[data-place-type-trigger]');
  if (panel instanceof HTMLElement) panel.hidden = true;
  if (trigger instanceof HTMLElement) {
    trigger.setAttribute('aria-expanded', 'false');
  }
  root.classList.remove('is-open');
}

function openPicker(root) {
  const panel = root.querySelector('[data-place-type-panel]');
  const trigger = root.querySelector('[data-place-type-trigger]');
  const filter = root.querySelector('[data-place-type-filter]');
  if (!(panel instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
    return;
  }
  // One open picker at a time.
  for (const other of document.querySelectorAll(
    '[data-place-type-picker].is-open',
  )) {
    if (other !== root) closePicker(other);
  }
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  root.classList.add('is-open');
  if (filter instanceof HTMLInputElement) {
    filter.value = '';
    applyFilter(root, '');
    filter.focus();
  }
}

function applyFilter(root, query) {
  const list = root.querySelector('[data-place-type-list]');
  if (!(list instanceof HTMLElement)) return;
  const q = query.trim().toLowerCase();
  for (const group of list.querySelectorAll('[data-place-type-group]')) {
    if (!(group instanceof HTMLElement)) continue;
    let any = false;
    for (const opt of group.querySelectorAll('[data-place-type-option]')) {
      if (!(opt instanceof HTMLElement)) continue;
      const label = (opt.dataset.label || opt.textContent || '').toLowerCase();
      const value = (opt.dataset.value || '').toLowerCase();
      const match = !q || label.includes(q) || value.includes(q);
      opt.hidden = !match;
      if (match) any = true;
    }
    group.hidden = !any;
  }
}

function selectOption(root, opt) {
  if (!(opt instanceof HTMLElement)) return;
  const valueInput = root.querySelector('[data-place-type-value]');
  const triggerLabel = root.querySelector('[data-place-type-trigger-label]');
  const list = root.querySelector('[data-place-type-list]');
  const trigger = root.querySelector('[data-place-type-trigger]');
  if (!(valueInput instanceof HTMLInputElement)) return;

  const value = opt.dataset.value || '';
  const label = opt.dataset.label || opt.textContent || value;
  valueInput.value = value;
  if (triggerLabel) triggerLabel.textContent = label;
  if (trigger instanceof HTMLElement) {
    trigger.classList.toggle('place-type-picker__trigger--empty', !value);
  }
  if (list) {
    for (const other of list.querySelectorAll('[data-place-type-option]')) {
      if (other instanceof HTMLElement) {
        other.setAttribute(
          'aria-selected',
          other === opt ? 'true' : 'false',
        );
      }
    }
  }
  valueInput.dispatchEvent(new Event('change', { bubbles: true }));
  closePicker(root);
  if (trigger instanceof HTMLElement) trigger.focus();
}

export function mountPlaceTypePicker(root) {
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.placeTypePickerMounted === '1') return;

  const trigger = root.querySelector('[data-place-type-trigger]');
  const filter = root.querySelector('[data-place-type-filter]');
  const list = root.querySelector('[data-place-type-list]');
  const panel = root.querySelector('[data-place-type-panel]');
  if (
    !(trigger instanceof HTMLButtonElement) ||
    !(filter instanceof HTMLInputElement) ||
    !(list instanceof HTMLElement) ||
    !(panel instanceof HTMLElement)
  ) {
    return;
  }

  root.dataset.placeTypePickerMounted = '1';
  ensureDocumentCloseHandlers();

  trigger.addEventListener('click', () => {
    if (panel.hidden) openPicker(root);
    else closePicker(root);
  });

  filter.addEventListener('input', () => {
    applyFilter(root, filter.value);
  });

  list.addEventListener('click', (e) => {
    const opt =
      e.target instanceof Element
        ? e.target.closest('[data-place-type-option]')
        : null;
    if (opt) selectOption(root, opt);
  });
}

export function mountAllPlaceTypePickers(scope = document) {
  scope.querySelectorAll('[data-place-type-picker]').forEach((el) => {
    mountPlaceTypePicker(el);
  });
}

/** Read current value from a picker value input or legacy select. */
export function readPlaceTypeValue(el) {
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    return el.value || '';
  }
  return '';
}

/** Set value on a place-type picker (updates label + selected option). */
export function setPlaceTypeValue(valueInput, nextValue) {
  if (!(valueInput instanceof HTMLInputElement)) return;
  const root = valueInput.closest('[data-place-type-picker]');
  if (!(root instanceof HTMLElement)) {
    valueInput.value = nextValue;
    return;
  }
  const emptyLabel = root.dataset.emptyLabel || 'Choose a place type…';
  const opt = nextValue
    ? root.querySelector(
        `[data-place-type-option][data-value="${CSS.escape(nextValue)}"]`,
      )
    : null;
  const label =
    (opt instanceof HTMLElement && (opt.dataset.label || opt.textContent)) ||
    (nextValue ? nextValue : emptyLabel);
  valueInput.value = nextValue;
  const triggerLabel = root.querySelector('[data-place-type-trigger-label]');
  if (triggerLabel) triggerLabel.textContent = label;
  const trigger = root.querySelector('[data-place-type-trigger]');
  if (trigger instanceof HTMLElement) {
    trigger.classList.toggle('place-type-picker__trigger--empty', !nextValue);
  }
  for (const other of root.querySelectorAll('[data-place-type-option]')) {
    if (other instanceof HTMLElement) {
      other.setAttribute(
        'aria-selected',
        other.dataset.value === nextValue ? 'true' : 'false',
      );
    }
  }
  valueInput.dispatchEvent(new Event('change', { bubbles: true }));
}
