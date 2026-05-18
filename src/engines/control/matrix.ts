/**
 * Lightweight matrix utilities for the Control Systems engine.
 * Supports add/sub/mul/transpose/det/inverse/eigenvalues for small matrices
 * (state-space sizes are typically n ≤ 8 in academic problems).
 */
import { polyRoots, type Complex } from './polynomial';

export type Matrix = number[][];

export function mZeros(rows: number, cols: number): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) out.push(new Array(cols).fill(0));
  return out;
}

export function mIdentity(n: number): Matrix {
  const I = mZeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

export function mClone(A: Matrix): Matrix {
  return A.map((r) => r.slice());
}

export function mShape(A: Matrix): [number, number] {
  return [A.length, A[0]?.length ?? 0];
}

export function mEqualShape(A: Matrix, B: Matrix): boolean {
  return A.length === B.length && (A[0]?.length ?? 0) === (B[0]?.length ?? 0);
}

export function mAdd(A: Matrix, B: Matrix): Matrix {
  if (!mEqualShape(A, B)) throw new Error('matrix add: shape mismatch');
  const [r, c] = mShape(A);
  const out = mZeros(r, c);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[i][j] = A[i][j] + B[i][j];
  return out;
}

export function mSub(A: Matrix, B: Matrix): Matrix {
  if (!mEqualShape(A, B)) throw new Error('matrix sub: shape mismatch');
  const [r, c] = mShape(A);
  const out = mZeros(r, c);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[i][j] = A[i][j] - B[i][j];
  return out;
}

export function mScale(A: Matrix, k: number): Matrix {
  return A.map((row) => row.map((v) => v * k));
}

export function mMul(A: Matrix, B: Matrix): Matrix {
  const [ra, ca] = mShape(A);
  const [rb, cb] = mShape(B);
  if (ca !== rb) throw new Error(`matrix mul: ${ra}x${ca} · ${rb}x${cb}`);
  const out = mZeros(ra, cb);
  for (let i = 0; i < ra; i++) {
    for (let k = 0; k < ca; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < cb; j++) out[i][j] += aik * B[k][j];
    }
  }
  return out;
}

export function mTranspose(A: Matrix): Matrix {
  const [r, c] = mShape(A);
  const out = mZeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = A[i][j];
  return out;
}

export function mDet(A: Matrix): number {
  const n = A.length;
  if (n === 0) return 1;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];

  // LU via partial pivot
  const M = mClone(A);
  let sign = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-14) return 0;
    if (p !== i) {
      [M[i], M[p]] = [M[p], M[i]];
      sign = -sign;
    }
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let j = i; j < n; j++) M[r][j] -= f * M[i][j];
    }
  }
  let det = sign;
  for (let i = 0; i < n; i++) det *= M[i][i];
  return det;
}

export function mInverse(A: Matrix): Matrix {
  const n = A.length;
  if (A[0]?.length !== n) throw new Error('matrix inverse: not square');
  const M = A.map((row, i) => [...row, ...mIdentity(n)[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-14) throw new Error('matrix inverse: singular');
    if (p !== i) [M[i], M[p]] = [M[p], M[i]];
    const piv = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[i][j];
    }
  }
  return M.map((row) => row.slice(n));
}

/** Rank via row-reduction with tolerance. */
export function mRank(A: Matrix, tol = 1e-10): number {
  if (A.length === 0) return 0;
  const M = mClone(A);
  const rows = M.length;
  const cols = M[0].length;
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < tol) continue;
    [M[r], M[p]] = [M[p], M[r]];
    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const f = M[i][c] / M[r][c];
      if (f === 0) continue;
      for (let j = c; j < cols; j++) M[i][j] -= f * M[r][j];
    }
    r++;
  }
  return r;
}

/**
 * Faddeev-LeVerrier: returns characteristic polynomial of A as coefficients
 * high→low (length n+1, monic).
 */
export function charPoly(A: Matrix): number[] {
  const n = A.length;
  let M = mIdentity(n);
  const coef = new Array(n + 1).fill(0);
  coef[0] = 1;
  // p_k = -(1/k) tr(M_k), then M_{k+1} = A·M_k + p_k·I
  for (let k = 1; k <= n; k++) {
    const AM = mMul(A, M);
    let tr = 0;
    for (let i = 0; i < n; i++) tr += AM[i][i];
    const pk = -tr / k;
    coef[k] = pk;
    M = mAdd(AM, mScale(mIdentity(n), pk));
  }
  return coef;
}

/** Eigenvalues of a real square matrix via roots of its characteristic polynomial. */
export function eigenvalues(A: Matrix): Complex[] {
  return polyRoots(charPoly(A));
}

/** Matrix exponential exp(A·t) via Padé(6) with scaling-and-squaring. */
export function expm(A: Matrix, t: number): Matrix {
  const n = A.length;
  // Scale
  let normA = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += Math.abs(A[i][j]);
    if (s > normA) normA = s;
  }
  normA *= Math.abs(t);
  const s = Math.max(0, Math.ceil(Math.log2(normA))) + 4;
  const scale = Math.pow(2, -s);
  const At = mScale(A, t * scale);

  // Padé(6) coefficients (numer & denom share same)
  const c = [1, 1 / 2, 5 / 44, 1 / 66, 1 / 792, 1 / 15840, 1 / 665280];
  let X: Matrix = mIdentity(n);
  let N: Matrix = mScale(mIdentity(n), c[0]);
  let D: Matrix = mScale(mIdentity(n), c[0]);
  for (let k = 1; k <= 6; k++) {
    X = mMul(X, At);
    N = mAdd(N, mScale(X, c[k]));
    D = mAdd(D, mScale(X, (k % 2 === 0 ? 1 : -1) * c[k]));
  }
  let R = mMul(mInverse(D), N);
  for (let k = 0; k < s; k++) R = mMul(R, R);
  return R;
}

export function formatMatrix(A: Matrix, name?: string): string[] {
  if (A.length === 0) return [name ? `${name} = [ ]` : '[ ]'];
  const cells = A.map((row) =>
    row.map((v) => {
      if (Math.abs(v) < 1e-12) return '0';
      if (Math.abs(v - Math.round(v)) < 1e-6) return String(Math.round(v));
      return v.toFixed(3);
    })
  );
  const colWidths: number[] = [];
  const cols = cells[0].length;
  for (let j = 0; j < cols; j++) {
    let w = 0;
    for (let i = 0; i < cells.length; i++) w = Math.max(w, cells[i][j].length);
    colWidths.push(w);
  }
  const lines = cells.map((row) =>
    `| ${row.map((c, j) => c.padStart(colWidths[j])).join('  ')} |`
  );
  if (name) lines[0] = `${name} = ` + lines[0];
  return lines;
}
