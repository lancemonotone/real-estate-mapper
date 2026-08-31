type GalleryOverlay = {
  ac: AbortController;
  root: HTMLElement;
};

let activeGallery: GalleryOverlay | null = null;

function svgIcon(paths: string[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function iconBtn(
  label: string,
  icon: SVGSVGElement,
  onClick: () => void,
  signal: AbortSignal,
  className = 'secondary icon-btn',
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.appendChild(icon);
  btn.addEventListener('click', onClick, { signal });
  return btn;
}

export function closeListingGallery(): void {
  if (!activeGallery) return;
  activeGallery.ac.abort();
  activeGallery.root.remove();
  activeGallery = null;
  document.body.classList.remove('photo-gallery-open');
}

export function openListingGallery(urls: string[], index = 0): void {
  const items = urls
    .map((src) => (typeof src === 'string' ? src.trim() : ''))
    .filter(Boolean);
  if (items.length === 0) return;

  closeListingGallery();

  let current = Math.min(Math.max(0, index), items.length - 1);
  const ac = new AbortController();
  const { signal } = ac;

  const root = document.createElement('div');
  root.id = 'photo-gallery-overlay';
  root.className = 'photo-gallery';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Photo gallery');

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'photo-gallery__backdrop';
  backdrop.setAttribute('aria-label', 'Close gallery');
  backdrop.addEventListener('click', () => closeListingGallery(), { signal });

  const stage = document.createElement('div');
  stage.className = 'photo-gallery__stage';

  const img = document.createElement('img');
  img.className = 'photo-gallery__img';
  img.alt = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'photo-gallery__toolbar';

  const count = document.createElement('span');
  count.className = 'photo-gallery__count muted';

  const closeBtn = iconBtn(
    'Close gallery',
    svgIcon(['M6 6l12 12', 'M18 6L6 18']),
    () => closeListingGallery(),
    signal,
  );

  const prevBtn = iconBtn(
    'Previous photo',
    svgIcon(['M15 6l-6 6 6 6']),
    () => {
      current = (current - 1 + items.length) % items.length;
      render();
    },
    signal,
    'secondary icon-btn photo-gallery__nav photo-gallery__nav--prev',
  );

  const nextBtn = iconBtn(
    'Next photo',
    svgIcon(['M9 6l6 6-6 6']),
    () => {
      current = (current + 1) % items.length;
      render();
    },
    signal,
    'secondary icon-btn photo-gallery__nav photo-gallery__nav--next',
  );

  function render() {
    img.src = items[current] ?? '';
    count.textContent = `${current + 1} / ${items.length}`;
    const multi = items.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    root.setAttribute('aria-label', `Photo gallery — image ${current + 1} of ${items.length}`);
  }

  toolbar.append(count, closeBtn);
  stage.append(img, prevBtn, nextBtn, toolbar);
  root.append(backdrop, stage);
  document.body.appendChild(root);
  document.body.classList.add('photo-gallery-open');

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        closeListingGallery();
        return;
      }
      if (items.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        current = (current - 1 + items.length) % items.length;
        render();
      } else if (e.key === 'ArrowRight') {
        current = (current + 1) % items.length;
        render();
      }
    },
    { signal },
  );

  render();
  closeBtn.focus();
  activeGallery = { ac, root };
}

function parseUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (u): u is string => typeof u === 'string' && Boolean(u.trim()),
        )
      : [];
  } catch {
    return [];
  }
}

export function bindListingGalleries(
  root: ParentNode = document,
  signal?: AbortSignal,
): void {
  root.querySelectorAll<HTMLElement>('[data-listing-gallery]').forEach((el) => {
    el.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const urls = parseUrls(el.getAttribute('data-photo-urls'));
        const index = Number(el.getAttribute('data-photo-index') || '0') || 0;
        openListingGallery(urls, index);
      },
      { signal },
    );
  });
}

function bootListingHeroGallery(signal?: AbortSignal): void {
  const root = document.querySelector('[data-hero-gallery]');
  if (!(root instanceof HTMLElement)) return;

  const trigger = root.querySelector('[data-listing-gallery]');
  const raw = trigger?.getAttribute('data-photo-urls') || '[]';
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    urls = Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === 'string' && Boolean(u.trim()))
      : [];
  } catch {
    urls = [];
  }

  let index = 0;
  const img = root.querySelector('[data-hero-gallery-img]');
  const count = root.querySelector('[data-hero-gallery-count]');

  function render() {
    if (img instanceof HTMLImageElement && urls[index]) img.src = urls[index];
    if (count) count.textContent = `${index + 1} / ${urls.length}`;
    if (trigger instanceof HTMLElement) {
      trigger.setAttribute('data-photo-index', String(index));
    }
  }

  root.querySelector('[data-hero-gallery-prev]')?.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      if (urls.length === 0) return;
      index = (index - 1 + urls.length) % urls.length;
      render();
    },
    { signal },
  );
  root.querySelector('[data-hero-gallery-next]')?.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      if (urls.length === 0) return;
      index = (index + 1) % urls.length;
      render();
    },
    { signal },
  );
}

export function updateListingHeroPhotos(urls: string[]): void {
  const items = urls
    .map((src) => (typeof src === 'string' ? src.trim() : ''))
    .filter(Boolean);
  if (items.length === 0) return;

  const heroRoot = document.querySelector('[data-hero-gallery]');
  if (heroRoot instanceof HTMLElement) {
    const trigger = heroRoot.querySelector('[data-listing-gallery]');
    const img = heroRoot.querySelector('[data-hero-gallery-img]');
    const count = heroRoot.querySelector('[data-hero-gallery-count]');
    const json = JSON.stringify(items);

    if (trigger instanceof HTMLElement) {
      trigger.setAttribute('data-photo-urls', json);
      trigger.setAttribute('data-photo-index', '0');
    }
    if (img instanceof HTMLImageElement) {
      img.src = items[0]!;
    }
    if (count) {
      count.textContent = `1 / ${items.length}`;
    }
    bootListingGalleries();
    return;
  }

  const singlePhoto = document.querySelector('.listing-hero__gallery .listing-hero__photo');
  if (singlePhoto instanceof HTMLImageElement) {
    singlePhoto.src = items[0]!;
  }
}

export function bootListingGalleries(): void {
  closeListingGallery();

  const body = document.body as HTMLElement & {
    _listingGalleryAbort?: AbortController;
  };
  if (body._listingGalleryAbort instanceof AbortController) {
    body._listingGalleryAbort.abort();
  }
  const ac = new AbortController();
  body._listingGalleryAbort = ac;
  const { signal } = ac;

  bindListingGalleries(document, signal);
  bootListingHeroGallery(signal);
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', bootListingGalleries);
  document.addEventListener('astro:before-swap', closeListingGallery);
  document.addEventListener('wayhome:listing-photos-updated', () => {
    bootListingGalleries();
  });
}
