import type { Polynomial } from './polynomial';

export interface RouthArray {
  rows: number[][];
  signChanges: number;
  stable: boolean;
  rhpRoots: number;
  hadFirstColumnZero: boolean;
}

/**
 * Build the Routh-Hurwitz array for the given characteristic polynomial.
 * Counts sign changes in the first column and reports stability.
 */
export function routhArray(poly: Polynomial): RouthArray {
  const n = poly.length - 1;
  const rows: number[][] = [];
  // Row 0: even-indexed coefficients (highest first)
  const row0: number[] = [];
  for (let i = 0; i <= n; i += 2) row0.push(poly[i]);
  rows.push(row0);
  // Row 1: odd-indexed coefficients
  const row1: number[] = [];
  for (let i = 1; i <= n; i += 2) row1.push(poly[i]);
  // Pad row1 to same length
  while (row1.length < row0.length) row1.push(0);
  rows.push(row1);

  let hadFirstZero = false;

  for (let r = 2; r <= n; r++) {
    const prev = rows[r - 1];
    const prev2 = rows[r - 2];
    const denom = prev[0];
    const cols = prev.length;
    const newRow: number[] = [];
    for (let c = 0; c < cols - 1; c++) {
      if (denom === 0) {
        // Replace with small epsilon to avoid divide by zero
        newRow.push(NaN);
      } else {
        const v = (denom * prev2[c + 1] - prev2[0] * prev[c + 1]) / denom;
        newRow.push(v);
      }
    }
    while (newRow.length < cols) newRow.push(0);
    if (denom === 0) hadFirstZero = true;
    rows.push(newRow);
  }

  // Trim rows to length 1 at the end (Routh row n only has 1 element)
  for (let i = 0; i < rows.length; i++) {
    const want = Math.max(1, Math.ceil((n + 1 - i) / 2));
    rows[i] = rows[i].slice(0, want);
  }

  const firstCol = rows.map((r) => r[0]);
  let signChanges = 0;
  for (let i = 1; i < firstCol.length; i++) {
    const a = firstCol[i - 1];
    const b = firstCol[i];
    if (a === 0 || b === 0 || Number.isNaN(a) || Number.isNaN(b)) continue;
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) signChanges++;
  }

  return {
    rows,
    signChanges,
    stable: signChanges === 0 && !hadFirstZero,
    rhpRoots: signChanges,
    hadFirstColumnZero: hadFirstZero,
  };
}
