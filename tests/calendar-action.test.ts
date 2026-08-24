import { describe, expect, it } from 'vitest';
import { resolveOccupiedDrop } from '../src/lib/tours/calendar-action';

describe('resolveOccupiedDrop', () => {
  it('empty target → create', () => {
    expect(resolveOccupiedDrop(false)).toBe('create');
  });

  it('occupied without mode → need-choice', () => {
    expect(resolveOccupiedDrop(true)).toBe('need-choice');
  });

  it('occupied + merge/replace', () => {
    expect(resolveOccupiedDrop(true, 'merge')).toBe('merge');
    expect(resolveOccupiedDrop(true, 'replace')).toBe('replace');
  });
});
