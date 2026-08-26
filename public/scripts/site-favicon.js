/** Theme-aware favicon: Fraunces W on --bg-0, letter in --primary. */
function faviconDataUrl(primary, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Wayhome">
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&amp;display=swap");
    .mark {
      font-family: "Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, serif;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.04em;
    }
  </style>
  <rect width="32" height="32" rx="8" fill="${bg}"/>
  <text class="mark" x="16" y="17" text-anchor="middle" dominant-baseline="middle" fill="${primary}">W</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function themeFaviconHref() {
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--primary').trim();
  const bg = styles.getPropertyValue('--bg-0').trim();
  if (!primary || !bg) return '/favicon.svg';
  return faviconDataUrl(primary, bg);
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
}

initThemeFavicon();
