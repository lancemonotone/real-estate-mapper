/**
 * Tiny SVG icons for compact action buttons (vanilla DOM).
 * Paths match src/lib/ui/icon-glyphs.ts (Lucide set). Keep both in sync.
 */

const NS = 'http://www.w3.org/2000/svg';

/** @typedef {{ tag: 'path', d: string } | { tag: 'circle', cx: number, cy: number, r: number } | { tag: 'rect', x: number, y: number, width: number, height: number, rx?: number }} IconNode */

/** @type {Record<string, IconNode[]>} */
const GLYPHS = {
  pencilLine: [
    { tag: 'path', d: 'M13 21h8' },
    { tag: 'path', d: 'm15 5 4 4' },
    {
      tag: 'path',
      d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    },
  ],
  mapPin: [
    {
      tag: 'path',
      d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
    },
    { tag: 'circle', cx: 12, cy: 10, r: 3 },
  ],
  route: [
    { tag: 'circle', cx: 6, cy: 19, r: 3 },
    { tag: 'path', d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' },
    { tag: 'circle', cx: 18, cy: 5, r: 3 },
  ],
  x: [
    { tag: 'path', d: 'M18 6 6 18' },
    { tag: 'path', d: 'm6 6 12 12' },
  ],
  ban: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M4.929 4.929 19.07 19.071' },
  ],
};

/**
 * @param {IconNode[]} nodes
 * @param {{ viewBox?: string }} [opts]
 */
export function svgIcon(nodes, { viewBox = '0 0 24 24' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const node of nodes) {
    if (node.tag === 'path') {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', node.d);
      svg.appendChild(path);
    } else if (node.tag === 'circle') {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(node.cx));
      circle.setAttribute('cy', String(node.cy));
      circle.setAttribute('r', String(node.r));
      svg.appendChild(circle);
    } else if (node.tag === 'rect') {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(node.x));
      rect.setAttribute('y', String(node.y));
      rect.setAttribute('width', String(node.width));
      rect.setAttribute('height', String(node.height));
      if (node.rx != null) rect.setAttribute('rx', String(node.rx));
      svg.appendChild(rect);
    }
  }
  return svg;
}

/** @param {string} name */
function glyph(name) {
  const nodes = GLYPHS[name];
  if (!nodes) throw new Error(`Unknown icon glyph: ${name}`);
  return svgIcon(nodes);
}

export function iconMapPin() {
  return glyph('mapPin');
}

export function iconRoute() {
  return glyph('route');
}

export function iconX() {
  return glyph('x');
}

export function iconPencil() {
  return glyph('pencilLine');
}

/** Circle with a slash — exclude / ban this place. */
export function iconBan() {
  return glyph('ban');
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
