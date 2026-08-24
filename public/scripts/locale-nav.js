function pillMetrics(nav, link) {
  return {
    x: link.offsetLeft,
    y: link.offsetTop,
    w: link.offsetWidth,
    h: link.offsetHeight,
  };
}

function applyPill(pill, metrics, { animate } = { animate: true }) {
  if (!animate) {
    pill.style.transition = 'none';
  }
  pill.style.width = `${metrics.w}px`;
  pill.style.height = `${metrics.h}px`;
  pill.style.transform = `translate(${metrics.x}px, ${metrics.y}px)`;
  if (!animate) {
    void pill.offsetWidth;
    pill.style.transition = '';
  }
}

function pathOf(href) {
  try {
    return new URL(href, location.origin).pathname.replace(/\/$/, '') || '/';
  } catch {
    return href;
  }
}

function findActiveLink(nav, pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  const links = [...nav.querySelectorAll('[data-locale-nav-link]')];
  let best = null;
  let bestLen = -1;
  for (const link of links) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    const hrefPath = pathOf(link.getAttribute('href') || '');
    if (path === hrefPath || path.startsWith(`${hrefPath}/`)) {
      if (hrefPath.length > bestLen) {
        best = link;
        bestLen = hrefPath.length;
      }
    }
  }
  return best;
}

function setActive(nav, link, { animate }) {
  const pill = nav.querySelector('[data-locale-nav-pill]');
  if (!(pill instanceof HTMLElement) || !(link instanceof HTMLElement)) return;

  nav.querySelectorAll('[data-locale-nav-link]').forEach((a) => {
    const on = a === link;
    a.classList.toggle('locale-nav__link--active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  applyPill(pill, pillMetrics(nav, link), { animate });
  nav.classList.add('is-ready');
}

function syncFromLocation(nav, { animate }) {
  const active = findActiveLink(nav, location.pathname);
  if (!active) return;
  setActive(nav, active, { animate });
}

function bindNav(nav) {
  if (!(nav instanceof HTMLElement)) return;

  if (nav.dataset.localeNavBound !== '1') {
    nav.dataset.localeNavBound = '1';
    nav.querySelectorAll('[data-locale-nav-link]').forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      link.addEventListener('click', () => {
        // Slide immediately; ClientRouter swaps page body underneath.
        setActive(nav, link, { animate: true });
      });
    });
    window.addEventListener('resize', () => {
      syncFromLocation(nav, { animate: false });
    });
  }

  const firstPaint = nav.dataset.localeNavReady !== '1';
  nav.dataset.localeNavReady = '1';
  syncFromLocation(nav, { animate: !firstPaint });
}

function bootLocaleNavs() {
  document.querySelectorAll('[data-locale-nav]').forEach((nav) => bindNav(nav));
}

bootLocaleNavs();
document.addEventListener('astro:page-load', bootLocaleNavs);
