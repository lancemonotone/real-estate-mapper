export const DEFAULT_UI_THEME_ID = 'sea';

export type UiThemeId = 'sea' | 'steel' | 'sand';

export type UiTheme = {
  id: UiThemeId;
  label: string;
  /** Filled controls (primary buttons) */
  primary: string;
  /** Outlines / links / selection */
  accent: string;
};

export const UI_THEME_CATALOG: Record<UiThemeId, UiTheme> = {
  sea: {
    id: 'sea',
    label: 'Sea glass',
    primary: '#2dd4bf',
    accent: '#93c5fd',
  },
  steel: {
    id: 'steel',
    label: 'Cool steel',
    primary: '#60a5fa',
    accent: '#c4b5fd',
  },
  sand: {
    id: 'sand',
    label: 'Warm sand',
    primary: '#fbbf24',
    accent: '#fdba74',
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
