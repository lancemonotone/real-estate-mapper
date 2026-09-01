function syncHiddenInputs(list: HTMLElement) {
  list.querySelectorAll('[data-gallery-item]').forEach((item) => {
    const input = item.querySelector('input[name="photo_urls"]');
    const img = item.querySelector('img');
    if (input instanceof HTMLInputElement && img instanceof HTMLImageElement) {
      input.value = img.getAttribute('src') || img.src;
    }
  });
}

function storedCap(form: HTMLElement): number | null {
  const raw = form.getAttribute('data-photo-stored-cap');
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function photoCount(list: HTMLElement): number {
  return list.querySelectorAll('input[name="photo_urls"]').length;
}

function setCapNotice(form: HTMLElement, message: string | null) {
  const el = form.querySelector('[data-gallery-cap-status]');
  if (el) el.textContent = message ?? '';
}

function createItem(url: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'listing-form__gallery-item';
  li.dataset.galleryItem = '';
  li.draggable = true;
  li.innerHTML = `
    <input type="hidden" name="photo_urls" value="" />
    <img src="" alt="" draggable="false" />
    <button
      type="button"
      class="secondary icon-btn listing-form__gallery-remove"
      data-gallery-remove
      aria-label="Remove photo"
      title="Remove photo"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12"></path>
        <path d="M18 6L6 18"></path>
      </svg>
    </button>
  `;
  const input = li.querySelector('input[name="photo_urls"]');
  const img = li.querySelector('img');
  if (input instanceof HTMLInputElement) input.value = url;
  if (img instanceof HTMLImageElement) img.src = url;
  return li;
}

function addUrls(form: HTMLElement, list: HTMLElement, raw: string) {
  const urls = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const existing = new Set(
    [...list.querySelectorAll('input[name="photo_urls"]')].map((el) =>
      el instanceof HTMLInputElement ? el.value : '',
    ),
  );
  const cap = storedCap(form);
  let skipped = 0;
  for (const url of urls) {
    if (existing.has(url)) continue;
    if (cap != null && photoCount(list) >= cap) {
      skipped += 1;
      continue;
    }
    existing.add(url);
    list.appendChild(createItem(url));
  }
  syncHiddenInputs(list);
  if (skipped > 0) {
    setCapNotice(
      form,
      cap != null
        ? `Photo limit reached (${cap} per listing). Remove a photo or upgrade Hunt Pass.`
        : 'Photo limit reached for this listing.',
    );
  } else {
    setCapNotice(form, null);
  }
}

export function bindListingGalleryForm(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-gallery-form]').forEach((form) => {
    if (form.dataset.galleryFormBound === '1' && form.isConnected) return;
    form.dataset.galleryFormBound = '1';
    const list = form.querySelector<HTMLElement>('[data-gallery-list]');
    if (!list) return;

    let dragItem: HTMLElement | null = null;

    form.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      if (target.closest('[data-gallery-add-btn]')) {
        e.preventDefault();
        const ta = form.querySelector<HTMLTextAreaElement>('[data-gallery-add]');
        if (ta) {
          addUrls(form, list, ta.value);
          ta.value = '';
          form.dispatchEvent(new CustomEvent('listing-gallery-changed', { bubbles: true }));
        }
        return;
      }

      const removeBtn = target.closest('[data-gallery-remove]');
      if (!removeBtn) return;
      const item = removeBtn.closest<HTMLElement>('[data-gallery-item]');
      if (!item || !list.contains(item)) return;
      e.preventDefault();
      item.remove();
      syncHiddenInputs(list);
      setCapNotice(form, null);
      form.dispatchEvent(new CustomEvent('listing-gallery-changed', { bubbles: true }));
    });

    list.addEventListener('dragstart', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-gallery-remove]')) {
        e.preventDefault();
        return;
      }
      const item = target.closest<HTMLElement>('[data-gallery-item]');
      if (!item || !list.contains(item)) return;
      dragItem = item;
      item.classList.add('is-dragging');
      e.dataTransfer?.setData('text/plain', '');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });

    list.addEventListener('dragend', () => {
      dragItem?.classList.remove('is-dragging');
      list
        .querySelectorAll('.is-drag-over')
        .forEach((el) => el.classList.remove('is-drag-over'));
      dragItem = null;
      syncHiddenInputs(list);
      form.dispatchEvent(new CustomEvent('listing-gallery-changed', { bubbles: true }));
    });

    list.addEventListener('dragover', (e) => {
      if (!dragItem) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const over = (e.target as Element | null)?.closest?.('[data-gallery-item]');
      if (!(over instanceof HTMLElement) || over === dragItem || !list.contains(over)) {
        return;
      }
      list
        .querySelectorAll('.is-drag-over')
        .forEach((el) => el.classList.remove('is-drag-over'));
      over.classList.add('is-drag-over');
      const rect = over.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      if (before) list.insertBefore(dragItem, over);
      else list.insertBefore(dragItem, over.nextSibling);
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list
        .querySelectorAll('.is-drag-over')
        .forEach((el) => el.classList.remove('is-drag-over'));
      syncHiddenInputs(list);
      form.dispatchEvent(new CustomEvent('listing-gallery-changed', { bubbles: true }));
    });

    syncHiddenInputs(list);
  });
}

export function bootListingGalleryForms(root: ParentNode = document): void {
  bindListingGalleryForm(root);
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', () => bootListingGalleryForms());
  document.addEventListener('wayhome:listing-forms-bind', (e) => {
    const detail = (e as CustomEvent<{ root?: ParentNode }>).detail;
    bootListingGalleryForms(detail?.root ?? document);
  });
}
