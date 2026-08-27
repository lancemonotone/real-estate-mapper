function syncHiddenInputs(list: HTMLElement) {
  list.querySelectorAll('[data-gallery-item]').forEach((item) => {
    const input = item.querySelector('input[name="photo_urls"]');
    const img = item.querySelector('img');
    if (input instanceof HTMLInputElement && img instanceof HTMLImageElement) {
      input.value = img.src;
    }
  });
  list.querySelectorAll('[data-gallery-item]').forEach((item, i) => {
    item.classList.toggle('is-primary', i === 0);
    const badge = item.querySelector('[data-gallery-primary-label]');
    if (badge) badge.hidden = i !== 0;
  });
}

function addUrls(list: HTMLElement, raw: string) {
  const urls = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const existing = new Set(
    [...list.querySelectorAll('input[name="photo_urls"]')].map((el) =>
      el instanceof HTMLInputElement ? el.value : '',
    ),
  );
  for (const url of urls) {
    if (existing.has(url)) continue;
    existing.add(url);
    const li = document.createElement('li');
    li.className = 'listing-form__gallery-item';
    li.dataset.galleryItem = '';
    li.innerHTML = `
      <input type="hidden" name="photo_urls" value="" />
      <img src="" alt="" />
      <span class="badge" data-gallery-primary-label hidden>Primary</span>
      <div class="listing-form__gallery-actions">
        <button type="button" class="secondary" data-gallery-primary>Make primary</button>
        <button type="button" class="secondary" data-gallery-up>Up</button>
        <button type="button" class="secondary" data-gallery-down>Down</button>
        <button type="button" class="secondary" data-gallery-remove>Remove</button>
      </div>
    `;
    const input = li.querySelector('input[name="photo_urls"]');
    const img = li.querySelector('img');
    if (input instanceof HTMLInputElement) input.value = url;
    if (img instanceof HTMLImageElement) img.src = url;
    list.appendChild(li);
  }
  syncHiddenInputs(list);
}

export function bindListingGalleryForm(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-gallery-form]').forEach((form) => {
    if (form.dataset.galleryFormBound === '1') return;
    form.dataset.galleryFormBound = '1';
    const list = form.querySelector<HTMLElement>('[data-gallery-list]');
    if (!list) return;

    form.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const item = target.closest<HTMLElement>('[data-gallery-item]');
      if (!item || !list.contains(item)) {
        if (target.closest('[data-gallery-add-btn]')) {
          e.preventDefault();
          const ta = form.querySelector<HTMLTextAreaElement>('[data-gallery-add]');
          if (ta) {
            addUrls(list, ta.value);
            ta.value = '';
          }
        }
        return;
      }
      e.preventDefault();
      if (target.closest('[data-gallery-remove]')) {
        item.remove();
        syncHiddenInputs(list);
        return;
      }
      if (target.closest('[data-gallery-primary]')) {
        list.prepend(item);
        syncHiddenInputs(list);
        return;
      }
      if (target.closest('[data-gallery-up]')) {
        const prev = item.previousElementSibling;
        if (prev) list.insertBefore(item, prev);
        syncHiddenInputs(list);
        return;
      }
      if (target.closest('[data-gallery-down]')) {
        const next = item.nextElementSibling;
        if (next) list.insertBefore(next, item);
        syncHiddenInputs(list);
      }
    });

    syncHiddenInputs(list);
  });
}
