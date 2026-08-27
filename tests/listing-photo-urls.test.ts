import { describe, expect, it } from 'vitest';
import {
  mergePhotoUrls,
  normalizePhotoUrls,
  primaryPhotoUrl,
  resolvePhotoFields,
} from '../src/lib/listings/photo-urls';

describe('normalizePhotoUrls', () => {
  it('trims, drops empties, dedupes first-wins', () => {
    expect(normalizePhotoUrls(['  a  ', '', 'b', 'a', '  b '])).toEqual([
      'a',
      'b',
    ]);
  });

  it('returns [] for non-arrays', () => {
    expect(normalizePhotoUrls(null)).toEqual([]);
    expect(normalizePhotoUrls('x')).toEqual([]);
  });
});

describe('mergePhotoUrls', () => {
  it('keeps existing primary at front when still present', () => {
    expect(mergePhotoUrls(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('uses incoming order when primary missing', () => {
    expect(mergePhotoUrls(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });
});

describe('primaryPhotoUrl', () => {
  it('returns first url or null', () => {
    expect(primaryPhotoUrl(['a', 'b'])).toBe('a');
    expect(primaryPhotoUrl([])).toBeNull();
  });
});

describe('resolvePhotoFields', () => {
  it('derives photo_url from photo_urls[0]', () => {
    expect(
      resolvePhotoFields({
        photo_urls: ['https://x/a.jpg', 'https://x/b.jpg'],
      }),
    ).toEqual({
      photo_urls: ['https://x/a.jpg', 'https://x/b.jpg'],
      photo_url: 'https://x/a.jpg',
    });
  });

  it('legacy photo_url alone becomes one-item gallery', () => {
    expect(resolvePhotoFields({ photo_url: 'https://x/a.jpg' })).toEqual({
      photo_urls: ['https://x/a.jpg'],
      photo_url: 'https://x/a.jpg',
    });
  });

  it('applies keep-primary when existingPrimary set and photo_urls provided', () => {
    expect(
      resolvePhotoFields({
        photo_urls: ['https://x/a.jpg', 'https://x/b.jpg'],
        existingPrimary: 'https://x/b.jpg',
      }),
    ).toEqual({
      photo_urls: ['https://x/b.jpg', 'https://x/a.jpg'],
      photo_url: 'https://x/b.jpg',
    });
  });
});
