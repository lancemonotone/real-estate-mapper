import {
  applyDemoOverlayToDocument,
  classifyDemoApi,
  clearDemoOverlay,
  clearOverlayIfHardReload,
  jsonResponse,
  recordRoutineMutation,
} from './demo-overlay.js';

const DEMO_TOAST_MS = 3200;

export function isDemoSession() {
  return document.documentElement.dataset.demo === '1';
}

export function showDemoToast(message = 'Demo · not saved') {
  let toast = document.getElementById('demo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'demo-toast';
    toast.className = 'demo-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.visible = '1';
  window.clearTimeout(showDemoToast._timer);
  showDemoToast._timer = window.setTimeout(() => {
    delete toast.dataset.visible;
  }, DEMO_TOAST_MS);
}

export function isDemoReadonlyError(error) {
  if (!error) return false;
  if (typeof error === 'object') {
    if (error.code === 'demo_readonly') return true;
    if (String(error.message || '').includes('Demo · not saved')) return true;
  }
  if (typeof error === 'string') {
    return error.includes('Demo · not saved') || error === 'demo_readonly';
  }
  return false;
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input) return String(input.url);
  return '';
}

function requestMethod(input, init) {
  if (init?.method) return init.method;
  if (input && typeof input === 'object' && 'method' in input) return String(input.method);
  return 'GET';
}

/** Wrap fetch once: routine → overlay soft success; destructive → toast, no network. */
export function installDemoFetchGuard() {
  if (!isDemoSession() || window.__wayhomeDemoFetch) return;
  window.__wayhomeDemoFetch = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!isDemoSession()) return original(input, init);

    const href = requestUrl(input);
    let pathname = href;
    try {
      pathname = new URL(href, window.location.origin).pathname;
    } catch {
      /* keep href */
    }
    const method = requestMethod(input, init);
    const kind = classifyDemoApi(pathname, method);

    if (pathname === '/api/auth/logout') {
      clearDemoOverlay();
      return original(input, init);
    }

    if (kind === 'allow') {
      return original(input, init);
    }

    if (kind === 'destructive') {
      showDemoToast('Demo · not saved');
      return jsonResponse(
        { ok: false, error: 'Demo · not saved', code: 'demo_readonly', demo: true },
        403,
      );
    }

    const payload = await recordRoutineMutation(pathname, method, init || {});
    return jsonResponse(payload, 200);
  };
}

/** Block demo form POSTs that mutate without going through fetch. */
function installDemoFormGuard() {
  if (!isDemoSession() || window.__wayhomeDemoForms) return;
  window.__wayhomeDemoForms = true;

  document.addEventListener(
    'submit',
    (event) => {
      if (!isDemoSession()) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const action = (form.getAttribute('action') || '').trim();
      let pathname = action;
      try {
        pathname = action ? new URL(action, window.location.origin).pathname : window.location.pathname;
      } catch {
        pathname = action || window.location.pathname;
      }

      const method = (form.getAttribute('method') || 'GET').toUpperCase();
      if (method === 'GET') return;

      if (pathname === '/api/auth/logout' || action.includes('/api/auth/logout')) {
        clearDemoOverlay();
        return;
      }

      // Settings invite rotate (same-page POST) and any other non-API mutate forms
      if (pathname.startsWith('/api/')) {
        const kind = classifyDemoApi(pathname, method);
        if (kind === 'allow') return;
        event.preventDefault();
        showDemoToast('Demo · not saved');
        return;
      }

      // Same-document POSTs (settings invite)
      event.preventDefault();
      showDemoToast('Demo · not saved');
    },
    true,
  );
}

export function bootDemoOverlay() {
  if (!isDemoSession()) return;
  installDemoFetchGuard();
  installDemoFormGuard();
  applyDemoOverlayToDocument();
}

if (isDemoSession()) {
  // Hard reload clears once per document load (not on every ClientRouter page-load).
  clearOverlayIfHardReload();
  bootDemoOverlay();
}

document.addEventListener('astro:page-load', () => {
  if (!isDemoSession()) return;
  applyDemoOverlayToDocument();
  // Re-bind guards if a full document swap reset window flags (rare).
  installDemoFetchGuard();
  installDemoFormGuard();
});
