export type UiBordersMode = 'on' | 'off';

export function resolveUiBorders(raw: unknown): UiBordersMode {
  if (raw === false || raw === 'off' || raw === 0 || raw === '0') return 'off';
  return 'on';
}

export function uiShowBordersFromMode(mode: UiBordersMode): boolean {
  return mode === 'on';
}
