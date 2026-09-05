/**
 * UI icons: Lucide (ISC), 24×24 stroke set.
 * https://lucide.dev — keep paths in sync with lucide-static @ latest when upgrading.
 *
 * Decorative/marketing SVGs (e.g. landing route art) are out of scope.
 */

export type IconGlyphName =
  | 'heart'
  | 'thumbsDown'
  | 'pencilLine'
  | 'x'
  | 'plus'
  | 'chevronLeft'
  | 'chevronRight'
  | 'externalLink'
  | 'mapPin'
  | 'home'
  | 'listCheck'
  | 'listChecks'
  | 'listX'
  | 'ban'
  | 'route'
  | 'calendar'
  | 'clock'
  | 'clockOff'
  | 'trash2'
  | 'settings'
  | 'logOut';

export type IconNode =
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

export const ICON_VIEWBOX = '0 0 24 24';

/** Lucide icon nodes keyed by app name. */
export const iconGlyphs: Record<IconGlyphName, readonly IconNode[]> = {
  heart: [
    {
      tag: 'path',
      d: 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
    },
  ],
  thumbsDown: [
    {
      tag: 'path',
      d: 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
    },
    { tag: 'path', d: 'M17 14V2' },
  ],
  pencilLine: [
    { tag: 'path', d: 'M13 21h8' },
    { tag: 'path', d: 'm15 5 4 4' },
    {
      tag: 'path',
      d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    },
  ],
  x: [
    { tag: 'path', d: 'M18 6 6 18' },
    { tag: 'path', d: 'm6 6 12 12' },
  ],
  plus: [
    { tag: 'path', d: 'M5 12h14' },
    { tag: 'path', d: 'M12 5v14' },
  ],
  chevronLeft: [{ tag: 'path', d: 'm15 18-6-6 6-6' }],
  chevronRight: [{ tag: 'path', d: 'm9 18 6-6-6-6' }],
  externalLink: [
    { tag: 'path', d: 'M15 3h6v6' },
    { tag: 'path', d: 'M10 14 21 3' },
    {
      tag: 'path',
      d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    },
  ],
  mapPin: [
    {
      tag: 'path',
      d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
    },
    { tag: 'circle', cx: 12, cy: 10, r: 3 },
  ],
  home: [
    {
      tag: 'path',
      d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
    },
    {
      tag: 'path',
      d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    },
  ],
  listCheck: [
    { tag: 'path', d: 'M16 5H3' },
    { tag: 'path', d: 'M16 12H3' },
    { tag: 'path', d: 'M11 19H3' },
    { tag: 'path', d: 'm15 18 2 2 4-4' },
  ],
  listChecks: [
    { tag: 'path', d: 'M13 5h8' },
    { tag: 'path', d: 'M13 12h8' },
    { tag: 'path', d: 'M13 19h8' },
    { tag: 'path', d: 'm3 17 2 2 4-4' },
    { tag: 'path', d: 'm3 7 2 2 4-4' },
  ],
  listX: [
    { tag: 'path', d: 'M11 12h10' },
    { tag: 'path', d: 'M11 18h10' },
    { tag: 'path', d: 'M11 6h10' },
    { tag: 'path', d: 'm3 6 4 4' },
    { tag: 'path', d: 'm7 6-4 4' },
  ],
  ban: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M4.929 4.929 19.07 19.071' },
  ],
  route: [
    { tag: 'circle', cx: 6, cy: 19, r: 3 },
    { tag: 'path', d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' },
    { tag: 'circle', cx: 18, cy: 5, r: 3 },
  ],
  calendar: [
    { tag: 'path', d: 'M8 2v3' },
    { tag: 'path', d: 'M16 2v3' },
    { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { tag: 'path', d: 'M3 9h18' },
  ],
  clock: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M12 6v6l4 2' },
  ],
  clockOff: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M12 6v6l4 2' },
    { tag: 'path', d: 'M4.929 4.929 19.07 19.071' },
  ],
  trash2: [
    { tag: 'path', d: 'M3 6h18' },
    { tag: 'path', d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' },
    { tag: 'path', d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' },
    { tag: 'path', d: 'M10 11v6' },
    { tag: 'path', d: 'M14 11v6' },
  ],
  settings: [
    {
      tag: 'path',
      d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
    },
    { tag: 'circle', cx: 12, cy: 12, r: 3 },
  ],
  logOut: [
    { tag: 'path', d: 'm16 17 5-5-5-5' },
    { tag: 'path', d: 'M21 12H9' },
    { tag: 'path', d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' },
  ],
};

function escapeAttr(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function iconNodeToMarkup(node: IconNode): string {
  switch (node.tag) {
    case 'path':
      return `<path d="${escapeAttr(node.d)}"></path>`;
    case 'circle':
      return `<circle cx="${escapeAttr(node.cx)}" cy="${escapeAttr(node.cy)}" r="${escapeAttr(node.r)}"></circle>`;
    case 'rect': {
      const rx = node.rx != null ? ` rx="${escapeAttr(node.rx)}"` : '';
      return `<rect x="${escapeAttr(node.x)}" y="${escapeAttr(node.y)}" width="${escapeAttr(node.width)}" height="${escapeAttr(node.height)}"${rx}></rect>`;
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** SVG markup for client HTML templates (bundled modules). */
export function iconSvgMarkup(name: IconGlyphName, className?: string): string {
  const nodes = iconGlyphs[name];
  const classAttr = className ? ` class="${escapeAttr(className)}"` : '';
  const inner = nodes.map(iconNodeToMarkup).join('');
  return `<svg viewBox="${ICON_VIEWBOX}" aria-hidden="true" focusable="false"${classAttr}>${inner}</svg>`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Live SVG element for client DOM builders. */
export function iconSvgElement(name: IconGlyphName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', ICON_VIEWBOX);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const node of iconGlyphs[name]) {
    switch (node.tag) {
      case 'path': {
        const el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('d', node.d);
        svg.appendChild(el);
        break;
      }
      case 'circle': {
        const el = document.createElementNS(SVG_NS, 'circle');
        el.setAttribute('cx', String(node.cx));
        el.setAttribute('cy', String(node.cy));
        el.setAttribute('r', String(node.r));
        svg.appendChild(el);
        break;
      }
      case 'rect': {
        const el = document.createElementNS(SVG_NS, 'rect');
        el.setAttribute('x', String(node.x));
        el.setAttribute('y', String(node.y));
        el.setAttribute('width', String(node.width));
        el.setAttribute('height', String(node.height));
        if (node.rx != null) el.setAttribute('rx', String(node.rx));
        svg.appendChild(el);
        break;
      }
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return svg;
}
