import { describe, expect, it } from 'vitest';
import {
  iconGlyphs,
  iconSvgMarkup,
  type IconGlyphName,
} from '../src/lib/ui/icon-glyphs';

const names = Object.keys(iconGlyphs) as IconGlyphName[];

describe('iconGlyphs (Lucide set)', () => {
  it('defines every named glyph with at least one node', () => {
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(iconGlyphs[name].length).toBeGreaterThan(0);
    }
  });

  it('renders svg markup for each glyph', () => {
    for (const name of names) {
      const html = iconSvgMarkup(name);
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toMatch(/<\/svg>$/);
    }
  });

  it('includes reaction and edit icons used in listing chrome', () => {
    expect(names).toEqual(
      expect.arrayContaining(['heart', 'thumbsDown', 'pencilLine', 'x', 'mapPin']),
    );
  });
});
