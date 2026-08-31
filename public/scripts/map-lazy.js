/**
 * Defer map init until the host is near or inside the viewport.
 */
export function whenMapVisible(host, initFn, { rootMargin = '200px' } = {}) {
  if (!(host instanceof HTMLElement)) return;

  if (!('IntersectionObserver' in window)) {
    initFn();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      initFn();
    },
    { rootMargin },
  );

  observer.observe(host);
}
