/**
 * Full-bleed sticky header once main content meets the chrome.
 * Brand + nav stay inset via .app-header__inner.
 */

const SENTINEL_CLASS = 'app-header-pin-sentinel';
const DESKTOP_MQ = '(min-width: 768px)';

/** @type {IntersectionObserver | null} */
let observer = null;
/** @type {HTMLElement | null} */
let sentinel = null;
/** @type {AbortController | null} */
let resizeAbort = null;

function teardown() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (sentinel?.isConnected) {
    sentinel.remove();
  }
  sentinel = null;
  if (resizeAbort) {
    resizeAbort.abort();
    resizeAbort = null;
  }
}

function headerHeight(header) {
  return Math.max(1, Math.round(header.getBoundingClientRect().height));
}

function setPinned(header, pinned) {
  header.classList.toggle('is-pinned', Boolean(pinned));
}

function initAppHeaderPin() {
  teardown();

  const header = document.querySelector('.app-header');
  const main = document.querySelector('.app-main');
  if (!(header instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

  const desktopMq = window.matchMedia(DESKTOP_MQ);
  if (!desktopMq.matches) {
    header.classList.remove('is-pinned');
    return;
  }

  sentinel = document.createElement('div');
  sentinel.className = SENTINEL_CLASS;
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText =
    'display:block;inline-size:100%;block-size:1px;margin:0;padding:0;pointer-events:none;';
  main.prepend(sentinel);

  const observe = () => {
    if (!sentinel) return;
    if (observer) observer.disconnect();
    const h = headerHeight(header);
    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setPinned(header, !entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        // Pin when the main top crosses under the sticky header.
        rootMargin: `-${h + 1}px 0px 0px 0px`,
      },
    );
    observer.observe(sentinel);
  };

  observe();

  resizeAbort = new AbortController();
  window.addEventListener(
    'resize',
    () => {
      if (!desktopMq.matches) {
        header.classList.remove('is-pinned');
        teardown();
        return;
      }
      if (!sentinel?.isConnected) {
        initAppHeaderPin();
        return;
      }
      observe();
    },
    { passive: true, signal: resizeAbort.signal },
  );
}

document.addEventListener('astro:page-load', initAppHeaderPin);
document.addEventListener('DOMContentLoaded', initAppHeaderPin);
