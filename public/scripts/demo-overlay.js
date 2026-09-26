/**
 * Demo session overlay: routine mutations stay client-side until hard refresh.
 * Hard reload (F5) clears the store so SSR server data returns.
 */

const STORAGE_KEY = 'wayhome:demo-overlay:v1';

/** @typedef {{
 *   themeId?: string,
 *   borders?: 'on' | 'off',
 *   reactions?: Record<string, { favorite: boolean, passed: boolean }>,
 *   listings?: Record<string, Record<string, string>>,
 *   flags?: Record<string, unknown>,
 * }} DemoOverlay */

function emptyOverlay() {
  return {
    themeId: undefined,
    borders: undefined,
    reactions: {},
    listings: {},
    flags: {},
  };
}

function readStore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw);
    return {
      ...emptyOverlay(),
      ...parsed,
      reactions: parsed.reactions && typeof parsed.reactions === 'object' ? parsed.reactions : {},
      listings: parsed.listings && typeof parsed.listings === 'object' ? parsed.listings : {},
      flags: parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {},
    };
  } catch {
    return emptyOverlay();
  }
}

function writeStore(overlay) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
}

/**
 * Clear overlay on hard refresh so server truth returns.
 * Soft ClientRouter navigations keep the store.
 */
export function clearOverlayIfHardReload() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearDemoOverlay() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getDemoOverlay() {
  return readStore();
}

export function patchDemoOverlay(patch) {
  const prev = readStore();
  const next = { ...prev, ...patch };
  if (patch.reactions) {
    next.reactions = { ...prev.reactions, ...patch.reactions };
  }
  if (patch.listings) {
    next.listings = { ...prev.listings };
    for (const [id, fields] of Object.entries(patch.listings)) {
      next.listings[id] = { ...(prev.listings[id] || {}), ...fields };
    }
  }
  if (patch.flags) {
    next.flags = { ...prev.flags, ...patch.flags };
  }
  writeStore(next);
  return next;
}

/**
 * Classify API paths for demo soft-write behavior.
 * @returns {'allow' | 'routine' | 'destructive'}
 */
export function classifyDemoApi(pathname, method) {
  const m = (method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return 'allow';

  // Allowed: auth, demo Nest route optimize, read-only auto-plan preview
  if (pathname.startsWith('/api/auth/')) return 'allow';
  if (pathname === '/api/tours/optimize') return 'allow';
  if (pathname === '/api/tours/auto-plan') return 'allow';
  // Listing surface / photo GETs are GET → allow above

  // Paid / Google spend (except optimize above; photo GET is allow — display of known places)
  if (
    pathname.startsWith('/api/places/') &&
    pathname !== '/api/places/photo'
  ) {
    return 'destructive';
  }
  if (
    pathname === '/api/locales/preview-place' ||
    pathname === '/api/listings/geocode' ||
    pathname === '/api/listings/import-url' ||
    pathname.startsWith('/api/proximity/')
  ) {
    return 'destructive';
  }

  // Destructive / settings-class that should toast
  if (
    pathname === '/api/listings/delete' ||
    pathname === '/api/listings/create' ||
    pathname === '/api/locales/delete' ||
    pathname === '/api/locales/create' ||
    pathname.startsWith('/api/agent/') ||
    pathname === '/api/tours/promote-scratch' ||
    pathname === '/api/tours/auto-plan-apply' ||
    pathname === '/api/tours/auto-plan-save' ||
    pathname === '/api/profile/dev-hunt-pass-preview'
  ) {
    return 'destructive';
  }

  // Routine soft-writes (appear to save; overlay only)
  return 'routine';
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Record overlay side-effects from a routine mutation request.
 */
export async function recordRoutineMutation(pathname, method, init) {
  const overlay = readStore();

  if (pathname === '/api/profile/theme') {
    const body = await cloneJsonBody(init);
    if (body && typeof body.ui_theme_id === 'string') {
      patchDemoOverlay({ themeId: body.ui_theme_id });
      document.documentElement.dataset.theme = body.ui_theme_id;
    }
    return { ok: true, demo: true };
  }

  if (pathname === '/api/profile/borders') {
    const body = await cloneJsonBody(init);
    if (body && typeof body.ui_show_borders === 'boolean') {
      const borders = body.ui_show_borders ? 'on' : 'off';
      patchDemoOverlay({ borders });
      document.documentElement.dataset.uiBorders = borders;
    }
    return { ok: true, demo: true };
  }

  if (pathname === '/api/listings/favorite' || pathname === '/api/listings/passed') {
    const body = await cloneJsonBody(init);
    const listingId = body && typeof body.listingId === 'string' ? body.listingId : '';
    if (listingId) {
      const prev = overlay.reactions[listingId] || { favorite: false, passed: false };
      const next =
        pathname.endsWith('favorite')
          ? {
              favorite: Boolean(body.favorite),
              passed: body.favorite ? false : prev.passed,
            }
          : {
              favorite: body.passed ? false : prev.favorite,
              passed: Boolean(body.passed),
            };
      patchDemoOverlay({ reactions: { [listingId]: next } });
      return { ok: true, demo: true, ...next };
    }
    return { ok: true, demo: true };
  }

  if (pathname === '/api/listings/update' || pathname.endsWith('/update')) {
    const fields = await cloneFormFields(init);
    const id = fields.id || '';
    if (id) {
      patchDemoOverlay({ listings: { [id]: fields } });
      return { ok: true, demo: true, listing: { id, ...fields } };
    }
    return { ok: true, demo: true };
  }

  // Generic routine success for tours calendar, appointment, endpoints, unassign, etc.
  const body = await cloneJsonBody(init);
  if (pathname === '/api/tours/calendar-action' && body && typeof body === 'object') {
    // Soft success shape matches applyCalendarAction ok results enough for client callers.
    return { ok: true, demo: true, ...body, action: body.action };
  }
  return { ok: true, demo: true, ...(body && typeof body === 'object' ? body : {}) };
}

async function cloneJsonBody(init) {
  if (!init || init.body == null) return null;
  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body);
    } catch {
      return null;
    }
  }
  if (init.body instanceof FormData) {
    return null;
  }
  if (init.body instanceof Blob) {
    try {
      return JSON.parse(await init.body.text());
    } catch {
      return null;
    }
  }
  return null;
}

async function cloneFormFields(init) {
  const fields = {};
  if (!init || init.body == null) return fields;
  if (init.body instanceof FormData) {
    for (const [key, value] of init.body.entries()) {
      if (typeof value === 'string') fields[key] = value;
    }
    return fields;
  }
  if (typeof init.body === 'string') {
    try {
      const params = new URLSearchParams(init.body);
      for (const [key, value] of params.entries()) fields[key] = value;
    } catch {
      /* ignore */
    }
  }
  return fields;
}

/** Apply stored overlay to the current document (theme, borders, reactions, listing forms). */
export function applyDemoOverlayToDocument() {
  const overlay = readStore();
  if (overlay.themeId) {
    document.documentElement.dataset.theme = overlay.themeId;
    document.querySelectorAll('input[name="ui_theme_id"]').forEach((el) => {
      if (el instanceof HTMLInputElement) {
        el.checked = el.value === overlay.themeId;
      }
    });
  }
  if (overlay.borders === 'on' || overlay.borders === 'off') {
    document.documentElement.dataset.uiBorders = overlay.borders;
    const borders = document.getElementById('ui-show-borders');
    if (borders instanceof HTMLInputElement) {
      borders.checked = overlay.borders === 'on';
    }
  }
  for (const [listingId, reaction] of Object.entries(overlay.reactions || {})) {
    document.dispatchEvent(
      new CustomEvent('listing-reaction-changed', {
        detail: {
          listingId,
          favorite: Boolean(reaction.favorite),
          passed: Boolean(reaction.passed),
        },
      }),
    );
    document.querySelectorAll(`[data-favorite-toggle][data-listing-id="${listingId}"]`).forEach((el) => {
      if (!(el instanceof HTMLButtonElement)) return;
      el.setAttribute('aria-pressed', reaction.favorite ? 'true' : 'false');
    });
    document.querySelectorAll(`[data-passed-toggle][data-listing-id="${listingId}"]`).forEach((el) => {
      if (!(el instanceof HTMLButtonElement)) return;
      el.setAttribute('aria-pressed', reaction.passed ? 'true' : 'false');
    });
    document.querySelectorAll(`[data-listing-id="${listingId}"]`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.hasAttribute('data-favorite')) el.dataset.favorite = reaction.favorite ? '1' : '0';
      if (el.hasAttribute('data-passed')) el.dataset.passed = reaction.passed ? '1' : '0';
    });
  }
  for (const [listingId, fields] of Object.entries(overlay.listings || {})) {
    const form = document.querySelector(
      `form[data-listing-autosave] input[name="id"][value="${CSS.escape(listingId)}"]`,
    )?.closest('form');
    if (!(form instanceof HTMLFormElement)) continue;
    for (const [name, value] of Object.entries(fields)) {
      if (name === 'id' || name === 'photo_urls') continue;
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
        input.value = value;
      }
    }
  }
}
