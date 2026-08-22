export const DEFAULT_UI_THEME_ID = 'sea';

export type UiThemeId = 'sea' | 'steel' | 'sand';

export type UiTheme = {
  id: UiThemeId;
  label: string;
  /** Filled controls (primary buttons) — light */
  primary: string;
  /** Filled controls — dark */
  primaryDark: string;
  /** Outlines / links / selection — light */
  accent: string;
  /** Outlines / links / selection — dark */
  accentDark: string;
};

export const UI_THEME_CATALOG: Record<UiThemeId, UiTheme> = {
  sea: {
    id: 'sea',
    label: 'Sea glass',
    primary: '#0d9488',
    primaryDark: '#2dd4bf',
    accent: '#2563eb',
    accentDark: '#93c5fd',
  },
  steel: {
    id: 'steel',
    label: 'Cool steel',
    primary: '#3b82f6',
    primaryDark: '#60a5fa',
    accent: '#7c3aed',
    accentDark: '#c4b5fd',
  },
  sand: {
    id: 'sand',
    label: 'Warm sand',
    primary: '#d97706',
    primaryDark: '#fbbf24',
    accent: '#c2410c',
    accentDark: '#fdba74',
  },
};

export function listUiThemes(): UiTheme[] {
  return Object.values(UI_THEME_CATALOG);
}

export function isUiThemeId(id: string): id is UiThemeId {
  return Object.prototype.hasOwnProperty.call(UI_THEME_CATALOG, id);
}

/** Fail Fast default: unknown / missing → sea (never invent a theme). */
export function resolveUiThemeId(raw: string | null | undefined): UiThemeId {
  if (!raw || !isUiThemeId(raw)) {
    return DEFAULT_UI_THEME_ID;
  }
  return raw;
}
