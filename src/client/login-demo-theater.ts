const THEATER_MS = 1200;

function fillSlowly(input: HTMLInputElement, value: string, durationMs: number) {
  input.value = '';
  const chars = [...value];
  if (chars.length === 0) return Promise.resolve();
  const step = Math.max(20, Math.floor(durationMs / chars.length));
  return new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      input.value += chars[i] ?? '';
      i += 1;
      if (i >= chars.length) {
        resolve();
        return;
      }
      window.setTimeout(tick, step);
    };
    tick();
  });
}

async function runDemoTheater() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('v')?.trim() ?? '';
  if (!token) return;

  const form = document.querySelector<HTMLFormElement>('form[data-login-form]');
  const email = form?.querySelector<HTMLInputElement>('input[name="email"]');
  const password = form?.querySelector<HTMLInputElement>('input[name="password"]');
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !email || !password || !submit) return;

  form.dataset.demoTheater = '1';
  email.readOnly = true;
  password.readOnly = true;
  submit.disabled = true;

  const half = Math.floor(THEATER_MS / 2);
  await fillSlowly(email, 'demo@visitor', half);
  await fillSlowly(password, '••••••••••••', half);

  const res = await fetch('/api/auth/demo-start', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
    credentials: 'same-origin',
    redirect: 'manual',
  });

  if (res.type === 'opaqueredirect' || res.status === 0 || (res.status >= 300 && res.status < 400)) {
    const url = new URL(window.location.href);
    url.searchParams.delete('v');
    window.history.replaceState({}, '', url.pathname + url.search);
    window.location.assign('/app');
    return;
  }

  if (res.ok) {
    window.location.assign('/app');
    return;
  }

  const data = await res.json().catch(() => null);
  const message =
    (data && typeof data.error === 'string' && data.error) ||
    'Demo entry is not available.';
  const alertEl = document.querySelector<HTMLElement>('[data-login-error]');
  if (alertEl) {
    alertEl.hidden = false;
    alertEl.textContent = message;
  }
  email.readOnly = false;
  password.readOnly = false;
  submit.disabled = false;
  delete form.dataset.demoTheater;
}

if (document.documentElement.dataset.demoEntry === '1') {
  void runDemoTheater();
}
