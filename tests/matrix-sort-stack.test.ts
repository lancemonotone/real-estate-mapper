import { describe, expect, it } from 'vitest';
import {
  applyMatrixSortClick,
  compareBySortStack,
  compareMatrixSortValues,
  type MatrixSortKey,
} from '../src/lib/ui/matrix-sort-stack';

describe('applyMatrixSortClick', () => {
  it('prepends a new column as ascending (newest is primary)', () => {
    const stack: MatrixSortKey[] = [{ colIndex: 1, dir: 'asc' }];
    expect(applyMatrixSortClick(stack, 3)).toEqual([
      { colIndex: 3, dir: 'asc' },
      { colIndex: 1, dir: 'asc' },
    ]);
  });

  it('flips active ascending to descending without changing priority', () => {
    const stack: MatrixSortKey[] = [
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'asc' },
    ];
    expect(applyMatrixSortClick(stack, 3)).toEqual([
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'desc' },
    ]);
  });

  it('removes active descending and keeps relative order of the rest', () => {
    const stack: MatrixSortKey[] = [
      { colIndex: 1, dir: 'asc' },
      { colIndex: 3, dir: 'desc' },
      { colIndex: 5, dir: 'asc' },
    ];
    expect(applyMatrixSortClick(stack, 3)).toEqual([
      { colIndex: 1, dir: 'asc' },
      { colIndex: 5, dir: 'asc' },
    ]);
  });

  it('does not mutate the input stack', () => {
    const stack: MatrixSortKey[] = [{ colIndex: 1, dir: 'asc' }];
    const next = applyMatrixSortClick(stack, 1);
    expect(stack).toEqual([{ colIndex: 1, dir: 'asc' }]);
    expect(next).toEqual([{ colIndex: 1, dir: 'desc' }]);
  });
});

describe('compareMatrixSortValues', () => {
  it('sorts empty last in both directions', () => {
    expect(compareMatrixSortValues(null, '1', 'number', 'asc')).toBe(1);
    expect(compareMatrixSortValues(null, '1', 'number', 'desc')).toBe(1);
  });

  it('compares numbers and text', () => {
    expect(compareMatrixSortValues('2', '10', 'number', 'asc')).toBeLessThan(0);
    expect(compareMatrixSortValues('b', 'a', 'text', 'asc')).toBeGreaterThan(0);
  });
});

describe('compareBySortStack', () => {
  it('uses later keys only when earlier keys tie', () => {
    const stack: MatrixSortKey[] = [
      { colIndex: 0, dir: 'asc' },
      { colIndex: 1, dir: 'desc' },
    ];
    const cells = [
      [
        { value: '1', type: 'number' },
        { value: 'a', type: 'text' },
      ],
      [
        { value: '1', type: 'number' },
        { value: 'z', type: 'text' },
      ],
    ];
    const cmp = compareBySortStack(
      stack,
      (c) => cells[0]![c]!,
      (c) => cells[1]![c]!,
    );
    expect(cmp).toBeGreaterThan(0);
  });
});
