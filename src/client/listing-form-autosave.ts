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
    if (status) status.textContent = 'Saved';
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
    if (form.dataset.listingAutosaveBound === '1') return;
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
