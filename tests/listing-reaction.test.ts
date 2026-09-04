import { describe, expect, it } from 'vitest';
import { reactionUpdate } from '../src/lib/listings/reaction';

describe('reactionUpdate', () => {
  it('turning favorite on clears passed', () => {
    expect(reactionUpdate('favorite', true, { favorite: false, passed: true })).toEqual({
      favorite: true,
      passed: false,
    });
  });

  it('turning favorite off leaves passed alone', () => {
    expect(reactionUpdate('favorite', false, { favorite: true, passed: false })).toEqual({
      favorite: false,
      passed: false,
    });
  });

  it('turning passed on clears favorite', () => {
    expect(reactionUpdate('passed', true, { favorite: true, passed: false })).toEqual({
      favorite: false,
      passed: true,
    });
  });

  it('turning passed off leaves favorite alone', () => {
    expect(reactionUpdate('passed', false, { favorite: false, passed: true })).toEqual({
      favorite: false,
      passed: false,
    });
  });
});
