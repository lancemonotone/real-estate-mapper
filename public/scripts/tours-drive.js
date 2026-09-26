/**
 * Drive overview: refresh route legs when the tour-day cache is stale.
 * Preserves visit order (does not geo-reorder stops).
 */

function driveRoot() {
  return document.querySelector('[data-tours-drive]');
}

async function refreshRouteIfNeeded() {
  const root = driveRoot();
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.needsAutoroute !== '1') return;

  const tourDayId = root.dataset.tourDayId?.trim();
  if (!tourDayId) return;

  const status = root.querySelector('[data-tours-drive-status]');
  if (status instanceof HTMLElement) {
    status.hidden = false;
    status.textContent = 'Updating drive times…';
  }

  try {
    const res = await fetch('/api/tours/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ tourDayId, preserveOrder: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (status instanceof HTMLElement) {
        status.textContent =
          typeof data.error === 'string' && data.error
            ? data.error
            : 'Could not update drive times';
      }
      return;
    }
    // Reload so SSR chips and totals match the new stored legs.
    location.reload();
  } catch (e) {
    if (status instanceof HTMLElement) {
      status.textContent =
        e instanceof Error ? e.message : 'Could not update drive times';
    }
  }
}

refreshRouteIfNeeded();
