/** Theme-aware favicon from computed --primary / --accent / --bg-0 tokens. */
function faviconDataUrl(primary, accent, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Wayhome">
  <rect width="32" height="32" rx="8" fill="${bg}"/>
  <path d="M16 7.5 23.5 13v11.5H8.5V13L16 7.5Z" fill="none" stroke="${primary}" stroke-width="1.75" stroke-linejoin="round"/>
  <circle cx="16" cy="17.5" r="2.25" fill="${primary}"/>
  <path d="M11 24.5c1.2-2.2 3-3.25 5-3.25s3.8 1.05 5 3.25" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function themeFaviconHref() {
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--primary').trim();
  const accent = styles.getPropertyValue('--accent').trim();
  const bg = styles.getPropertyValue('--bg-0').trim();
  if (!primary || !accent || !bg) return '/favicon.svg';
  return faviconDataUrl(primary, accent, bg);
}

function applyThemeFavicon() {
  let link = document.querySelector('link[data-site-favicon]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.dataset.siteFavicon = 'true';
    document.head.appendChild(link);
  }
  link.href = themeFaviconHref();
}

function initThemeFavicon() {
  applyThemeFavicon();

  if (initThemeFavicon.wired) return;
  initThemeFavicon.wired = true;

  document.addEventListener('astro:page-load', applyThemeFavicon);

  const observer = new MutationObserver(applyThemeFavicon);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyThemeFavicon);
}

initThemeFavicon();
