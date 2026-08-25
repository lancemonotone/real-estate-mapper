/** Tiny SVG icons for compact action buttons (vanilla DOM). */

export function svgIcon(paths, { viewBox = '0 0 24 24' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

export function iconMapPin() {
  return svgIcon([
    'M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z',
    'M12 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  ]);
}

export function iconRoute() {
  return svgIcon([
    'M4 19h4a3 3 0 0 0 0-6H6a3 3 0 0 1 0-6h4',
    'M14 7h6',
    'M17 4v6',
    'M14 17h6',
  ]);
}

export function iconX() {
  return svgIcon(['M6 6l12 12', 'M18 6L6 18']);
}

export function iconPencil() {
  return svgIcon([
    'M12 20h9',
    'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  ]);
}

/** Circle with a slash — exclude / ban this place. */
export function iconBan() {
  return svgIcon([
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M4.9 4.9l14.2 14.2',
  ]);
}

/** Invisible slot so trailing icons stay aligned when a leading action is missing. */
export function iconBtnSpacer() {
  const el = document.createElement('span');
  el.className = 'secondary icon-btn icon-btn--spacer';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function iconBtn({ label, icon, href, className = 'secondary icon-btn', onClick }) {
  const el = href
    ? Object.assign(document.createElement('a'), {
        href,
        target: '_blank',
        rel: 'noopener',
      })
    : Object.assign(document.createElement('button'), { type: 'button' });
  el.className = className;
  el.setAttribute('aria-label', label);
  el.setAttribute('title', label);
  el.appendChild(icon());
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
