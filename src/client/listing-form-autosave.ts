const DEBOUNCE_MS = 450;

function markDirty(form: HTMLFormElement) {
  form.dataset.listingAutosaveDirty = '1';
}

function markSaved(form: HTMLFormElement) {
  form.dataset.listingAutosaveDirty = '0';
  form.dataset.listingAutosaved = '1';
}

async function saveForm(form: HTMLFormElement): Promise<void> {
  if (form.dataset.listingAutosaveBusy === '1') {
    form.dataset.listingAutosaveQueued = '1';
    return;
  }

  const status = form.querySelector<HTMLElement>('[data-listing-autosave-status]');
  form.dataset.listingAutosaveBusy = '1';
  if (status) status.textContent = 'Saving…';

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const message =
        (data && typeof data.error === 'string' && data.error) ||
        `Save failed (${res.status})`;
      if (status) status.textContent = message;
      return;
    }
    markSaved(form);
    if (status) {
      const dropped =
        data && typeof data.photos_dropped === 'number' && data.photos_dropped > 0
          ? data.photos_dropped
          : 0;
      const limit =
        data && typeof data.photo_limit === 'number' ? data.photo_limit : null;
      if (dropped > 0 && limit != null) {
        status.textContent = `Saved. ${dropped} photo${dropped === 1 ? '' : 's'} over the ${limit}-photo Free limit were not saved.`;
      } else {
        status.textContent = 'Saved';
      }
    }
    const savedUrls =
      data?.listing &&
      Array.isArray(data.listing.photo_urls) &&
      data.listing.photo_urls.every((u: unknown) => typeof u === 'string')
        ? (data.listing.photo_urls as string[])
        : null;
    if (savedUrls) {
      const list = form.querySelector('[data-gallery-list]');
      if (list instanceof HTMLElement) {
        const inputs = [...list.querySelectorAll('input[name="photo_urls"]')];
        const current = inputs
          .map((el) => (el instanceof HTMLInputElement ? el.value : ''))
          .filter(Boolean);
        if (current.length !== savedUrls.length || current.some((u, i) => u !== savedUrls[i])) {
          inputs.slice(savedUrls.length).forEach((input) => {
            input.closest('[data-gallery-item]')?.remove();
          });
          inputs.slice(0, savedUrls.length).forEach((input, i) => {
            if (!(input instanceof HTMLInputElement)) return;
            input.value = savedUrls[i] ?? '';
            const img = input.parentElement?.querySelector('img');
            if (img instanceof HTMLImageElement) img.src = savedUrls[i] ?? '';
          });
        }
      }
    }
    if (data?.listing && typeof data.listing === 'object') {
      document.dispatchEvent(
        new CustomEvent('wayhome:listing-updated', {
          detail: { listing: data.listing },
          bubbles: true,
        }),
      );
    }
  } catch {
    if (status) status.textContent = 'Save failed';
  } finally {
    form.dataset.listingAutosaveBusy = '0';
    if (form.dataset.listingAutosaveQueued === '1') {
      form.dataset.listingAutosaveQueued = '0';
      void saveForm(form);
    }
  }
}

export function bindListingFormAutosave(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>('form[data-listing-autosave]').forEach((form) => {
    if (form.dataset.listingAutosaveBound === '1' && form.isConnected) return;
    form.dataset.listingAutosaveBound = '1';

    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      markDirty(form);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void saveForm(form);
      }, DEBOUNCE_MS);
    };

    const saveNow = () => {
      markDirty(form);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void saveForm(form);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNow();
    });

    form.addEventListener('input', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-gallery-add]')) return;
      schedule();
    });

    form.addEventListener('change', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-gallery-add]')) return;
      // File / date / checkbox-like — save promptly
      if (target instanceof HTMLInputElement && target.type === 'file') {
        saveNow();
        return;
      }
      schedule();
    });

    form.addEventListener('listing-gallery-changed', () => {
      saveNow();
    });

    form.addEventListener('listing-autosave-flush', () => {
      saveNow();
    });
  });
}

export function listingAutosaveNeedsReload(form: HTMLFormElement | null): boolean {
  return Boolean(form?.dataset.listingAutosaved === '1');
}

export function bootListingFormAutosave(root: ParentNode = document): void {
  bindListingFormAutosave(root);
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', () => bootListingFormAutosave());
  document.addEventListener('wayhome:listing-forms-bind', (e) => {
    const detail = (e as CustomEvent<{ root?: ParentNode }>).detail;
    bootListingFormAutosave(detail?.root ?? document);
  });
}
