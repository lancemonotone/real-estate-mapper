export function normalizePhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function mergePhotoUrls(
  incoming: string[],
  existingPrimary: string | null,
): string[] {
  const urls = normalizePhotoUrls(incoming);
  if (!existingPrimary) return urls;
  const primary = existingPrimary.trim();
  if (!primary || !urls.includes(primary)) return urls;
  return [primary, ...urls.filter((u) => u !== primary)];
}

export function primaryPhotoUrl(urls: string[]): string | null {
  return urls[0] ?? null;
}

export function resolvePhotoFields(input: {
  photo_urls?: unknown;
  photo_url?: unknown;
  existingPrimary?: string | null;
}): { photo_urls: string[]; photo_url: string | null } {
  const hasUrls = Object.prototype.hasOwnProperty.call(input, 'photo_urls');
  const hasLegacy = Object.prototype.hasOwnProperty.call(input, 'photo_url');

  let urls: string[];
  if (hasUrls) {
    urls = mergePhotoUrls(
      normalizePhotoUrls(input.photo_urls),
      input.existingPrimary ?? null,
    );
  } else if (hasLegacy) {
    const one =
      typeof input.photo_url === 'string' ? input.photo_url.trim() : '';
    urls = one ? [one] : [];
  } else {
    urls = [];
  }

  return { photo_urls: urls, photo_url: primaryPhotoUrl(urls) };
}
