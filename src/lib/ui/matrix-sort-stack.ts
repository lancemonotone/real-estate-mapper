export type MatrixSortDir = 'asc' | 'desc';

export type MatrixSortKey = {
  colIndex: number;
  dir: MatrixSortDir;
};

export type MatrixSortCell = {
  value: string | null;
  type: string;
};

export function applyMatrixSortClick(
  stack: MatrixSortKey[],
  colIndex: number,
): MatrixSortKey[] {
  const idx = stack.findIndex((k) => k.colIndex === colIndex);
  if (idx === -1) {
    // Newest column becomes primary; existing keys shift down as tiebreakers.
    return [{ colIndex, dir: 'asc' }, ...stack];
  }
  const current = stack[idx]!;
  if (current.dir === 'asc') {
    return stack.map((k, i) => (i === idx ? { ...k, dir: 'desc' as const } : k));
  }
  return stack.filter((_, i) => i !== idx);
}

export function compareMatrixSortValues(
  a: string | null,
  b: string | null,
  type: string,
  dir: MatrixSortDir,
): number {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  let result = 0;
  if (type === 'number') {
    result = Number(a) - Number(b);
  } else {
    result = String(a).localeCompare(String(b), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  }
  return dir === 'desc' ? -result : result;
}

export function compareBySortStack(
  stack: MatrixSortKey[],
  cellA: (colIndex: number) => MatrixSortCell,
  cellB: (colIndex: number) => MatrixSortCell,
): number {
  for (const key of stack) {
    const a = cellA(key.colIndex);
    const b = cellB(key.colIndex);
    const result = compareMatrixSortValues(a.value, b.value, a.type, key.dir);
    if (result !== 0) return result;
  }
  return 0;
}
