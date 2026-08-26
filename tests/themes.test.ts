import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_THEME_ID,
  listUiThemes,
  resolveUiThemeId,
} from '../src/lib/ui/themes';

describe('resolveUiThemeId', () => {
  it('defaults null/empty to sea', () => {
    expect(resolveUiThemeId(null)).toBe(DEFAULT_UI_THEME_ID);
    expect(resolveUiThemeId(undefined)).toBe('sea');
    expect(resolveUiThemeId('')).toBe('sea');
  });

  it('returns known ids', () => {
    expect(resolveUiThemeId('steel')).toBe('steel');
    expect(resolveUiThemeId('sand')).toBe('sand');
    expect(resolveUiThemeId('sea')).toBe('sea');
  });

  it('falls back unknown ids to sea', () => {
    expect(resolveUiThemeId('neon')).toBe('sea');
  });
});

describe('listUiThemes', () => {
  it('includes sea, steel, sand', () => {
    const ids = listUiThemes().map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['sea', 'steel', 'sand']));
  });

  it('defines primary and accent colors for each theme', () => {
    for (const theme of listUiThemes()) {
      expect(theme.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
