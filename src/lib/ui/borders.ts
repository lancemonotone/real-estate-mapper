export type UiBordersMode = 'on' | 'off';

/** Default off: only explicit on-ish values enable borders. */
export function resolveUiBorders(raw: unknown): UiBordersMode {
  if (raw === true || raw === 'on' || raw === 1 || raw === '1') return 'on';
  return 'off';
}

export function uiShowBordersFromMode(mode: UiBordersMode): boolean {
  return mode === 'on';
}
