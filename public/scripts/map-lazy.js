/**
 * Defer map init until the host is near or inside the viewport and has layout.
 */

/** @type {WeakMap<HTMLElement, IntersectionObserver>} */
const pendingObservers = new WeakMap();

function runWhenLaidOut(host, initFn) {
  const start = () => {
    if (!host.isConnected) return;
    if (host.clientWidth === 0 || host.clientHeight === 0) {
      requestAnimationFrame(start);
      return;
    }
    initFn();
  };
  requestAnimationFrame(() => requestAnimationFrame(start));
}

export function whenMapVisible(host, initFn, { rootMargin = '200px' } = {}) {
  if (!(host instanceof HTMLElement)) return;

  const prev = pendingObservers.get(host);
  prev?.disconnect();

  const run = () => runWhenLaidOut(host, initFn);

  if (!('IntersectionObserver' in window)) {
    run();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      pendingObservers.delete(host);
      run();
    },
    { rootMargin },
  );

  pendingObservers.set(host, observer);
  observer.observe(host);
}

/** After soft-nav / flex layout, Maps often needs a resize to render markers correctly. */
export function nudgeMapLayout(map, afterResize) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!map) return;
      google.maps.event.trigger(map, 'resize');
      afterResize?.();
    });
  });
}
