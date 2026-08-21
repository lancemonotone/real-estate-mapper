import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractListingFromHtml } from '../src/lib/listings/url-extract';

describe('extractListingFromHtml', () => {
  it('reads og:title, og:image, and postal address when present', () => {
    const html = readFileSync('tests/fixtures/sample-listing.html', 'utf8');
    const result = extractListingFromHtml(html, 'https://example.com/listing/1');
    expect(result).toEqual({
      name: '123 Main St Listing',
      address: '123 Main St, Springfield, IL 62701',
      photoUrl: 'https://cdn.example.com/photo.jpg',
    });
  });

  it('returns nulls when tags missing — never invents', () => {
    expect(extractListingFromHtml('<html></html>', 'https://example.com')).toEqual({
      name: null,
      address: null,
      photoUrl: null,
    });
  });
});
