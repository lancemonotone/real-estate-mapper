import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

export function openListingGallery(urls: string[], index = 0): void {
  const items = urls
    .map((src) => (typeof src === 'string' ? src.trim() : ''))
    .filter(Boolean)
    .map((src) => ({ src, width: 1600, height: 1200 }));
  if (items.length === 0) return;

  const startIndex = Math.min(Math.max(0, index), items.length - 1);
  const lightbox = new PhotoSwipeLightbox({
    dataSource: items,
    pswpModule: () => import('photoswipe'),
  });
  lightbox.init();
  lightbox.loadAndOpen(startIndex);
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

export function bindListingGalleries(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-listing-gallery]').forEach((el) => {
    if (el.dataset.galleryBound === '1') return;
    el.dataset.galleryBound = '1';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const urls = parseUrls(el.getAttribute('data-photo-urls'));
      const index = Number(el.getAttribute('data-photo-index') || '0') || 0;
      openListingGallery(urls, index);
    });
  });
}
