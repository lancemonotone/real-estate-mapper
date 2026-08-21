export type ExtractedListing = {
  name: string | null;
  address: string | null;
  photoUrl: string | null;
};

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    'i',
  );
  return html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null;
}

export function extractListingFromHtml(
  html: string,
  _sourceUrl: string,
): ExtractedListing {
  const name = metaContent(html, 'og:title');
  const photoUrl = metaContent(html, 'og:image');
  const addressMatch =
    html.match(/<address[^>]*itemprop=["']address["'][^>]*>([^<]+)<\/address>/i) ??
    html.match(/<address[^>]*>([^<]+)<\/address>/i);
  const address = addressMatch?.[1]?.trim() || null;
  return {
    name: name?.trim() || null,
    address,
    photoUrl: photoUrl?.trim() || null,
  };
}
