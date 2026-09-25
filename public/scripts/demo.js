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

export async function readDemoError(res) {
  const data = await res.clone().json().catch(() => null);
  if (data && (data.code === 'demo_readonly' || String(data.error || '').includes('Demo · not saved'))) {
    return data;
  }
  if (res.status === 403) {
    return { code: 'demo_readonly', error: 'Demo · not saved' };
  }
  return null;
}

/** Wrap fetch: demo sessions toast on demo_readonly responses. */
export function installDemoFetchGuard() {
  if (!isDemoSession() || window.__wayhomeDemoFetch) return;
  window.__wayhomeDemoFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await original(input, init);
    if (!isDemoSession()) return res;
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return res;
    if (res.status !== 403) return res;
    const demoErr = await readDemoError(res);
    if (demoErr) showDemoToast(demoErr.error || 'Demo · not saved');
    return res;
  };
}

if (isDemoSession()) {
  installDemoFetchGuard();
}
