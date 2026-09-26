/**
 * Demo portfolio entry on marketing splash:
 * let route/pin animations play, then simulate clicking Sign in → login theater.
 */

/** Route draw 350+1600; last pin ~1280+500. Beat after that. */
const SPLASH_HOLD_MS = 2200;
const CLICK_PRESS_MS = 280;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function runDemoSplashEntry() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('v')?.trim() ?? '';
  if (!token) return;

  const signIn = document.querySelector<HTMLAnchorElement>('[data-demo-sign-in]');
  if (!signIn) return;

  await sleep(SPLASH_HOLD_MS);

  signIn.classList.add('is-demo-press');
  signIn.focus({ preventScroll: true });
  await sleep(CLICK_PRESS_MS);

  window.location.assign(`/login?v=${encodeURIComponent(token)}`);
}

if (document.documentElement.dataset.demoSplash === '1') {
  void runDemoSplashEntry();
}
