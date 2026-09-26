import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_THEME_ID,
  listUiThemes,
  resolveUiThemeId,
} from '../src/lib/ui/themes';
import { resolveUiBorders } from '../src/lib/ui/borders';

describe('resolveUiThemeId', () => {
  it('defaults null/empty to Warm sand', () => {
    expect(resolveUiThemeId(null)).toBe(DEFAULT_UI_THEME_ID);
    expect(resolveUiThemeId(undefined)).toBe('sand');
    expect(resolveUiThemeId('')).toBe('sand');
    expect(DEFAULT_UI_THEME_ID).toBe('sand');
  });

  it('returns known ids', () => {
    expect(resolveUiThemeId('steel')).toBe('steel');
    expect(resolveUiThemeId('sand')).toBe('sand');
    expect(resolveUiThemeId('sea')).toBe('sea');
  });

  it('falls back unknown ids to Warm sand', () => {
    expect(resolveUiThemeId('neon')).toBe('sand');
  });
});

describe('resolveUiBorders', () => {
  it('defaults missing / falsey values to off', () => {
    expect(resolveUiBorders(undefined)).toBe('off');
    expect(resolveUiBorders(null)).toBe('off');
    expect(resolveUiBorders(false)).toBe('off');
    expect(resolveUiBorders('off')).toBe('off');
  });

  it('enables only explicit on values', () => {
    expect(resolveUiBorders(true)).toBe('on');
    expect(resolveUiBorders('on')).toBe('on');
    expect(resolveUiBorders(1)).toBe('on');
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
