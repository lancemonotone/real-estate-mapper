/**
 * Import-from-URL → fill the create ListingForm (new-listing overlay or legacy page).
 */
function fillCreateForm(data) {
  const form =
    document.querySelector(
      '[data-listing-overlay="new"] form[action="/api/listings/create"]',
    ) || document.querySelector('form[action="/api/listings/create"]');
  if (!(form instanceof HTMLFormElement)) return;

  const set = (name, value) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (el instanceof HTMLInputElement && value) el.value = value;
  };

  set('name', data.name);
  set('address', data.address);
  set('source_url', data.sourceUrl);

  const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl.trim() : '';
  if (photoUrl) {
    const ta = form.querySelector('[data-gallery-add]');
    const btn = form.querySelector('[data-gallery-add-btn]');
    if (ta instanceof HTMLTextAreaElement && btn instanceof HTMLElement) {
      ta.value = photoUrl;
      btn.click();
    }
  }
}

function bindListingImport(root = document) {
  const form = root.querySelector('#import-form');
  const status = root.querySelector('#import-status');
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.listingImportBound === '1') return;
  form.dataset.listingImportBound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlInput = form.querySelector('#import-url');
    const url = urlInput instanceof HTMLInputElement ? urlInput.value : '';
    if (status) status.textContent = 'Fetching…';
    try {
      const res = await fetch('/api/listings/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (status) status.textContent = data.error || 'Import failed';
        return;
      }
      fillCreateForm(data);
      if (status) {
        status.textContent =
          'Import finished — empty fields mean nothing was found (nothing invented).';
      }
    } catch {
      if (status) status.textContent = 'Import failed';
    }
  });
}

function initListingImport() {
  bindListingImport(document);
}

initListingImport();
document.addEventListener('astro:page-load', initListingImport);
