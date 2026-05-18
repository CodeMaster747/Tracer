/**
 * State-space representation utilities:
 *   - TF → SS conversion (controllable canonical form)
 *   - SS → TF conversion (C(sI-A)^-1 B + D via characteristic polynomial)
 *   - State transition matrix Φ(t) = exp(A·t)
 *   - Controllability matrix [B  AB  A²B …] and rank-based test
 *   - Observability matrix [C; CA; CA²; …] and rank-based test
 */
import type { Polynomial, TransferFunction } from './controlTypes';
import {
  charPoly,
  mMul,
  mZeros,
  mRank,
  type Matrix,
  expm,
  eigenvalues,
} from './matrix';
import { polyMul } from './polynomial';
import type { StateSpace } from './controlTypes';

/* ---------- TF → SS (Controllable Canonical Form) ---------- */
/**
 * Given a strictly/proper TF b_m s^m + … + b_0  /  s^n + a_{n-1} s^{n-1} + … + a_0
 * (numerator may have lower degree), returns CCF state-space.
 *
 *   A = | 0  1  0  …  0 |
 *       | 0  0  1  …  0 |
 *       | …             |
 *       |-a0 -a1 …  -a_{n-1}|
 *
 *   B = [0; 0; …; 1]
 *
 *   C = [b_0 - a_0 d, b_1 - a_1 d, …]  (with d = b_n / a_n when proper)
 *
 *   D = b_n / a_n  (0 if strictly proper)
 */
export function tfToStateSpaceCCF(tf: TransferFunction): StateSpace {
  // Normalize so denominator is monic.
  const den = tf.denominator.slice();
  const num = tf.numerator.slice();
  if (den.length === 0 || den[0] === 0) throw new Error('Denominator is zero or empty');
  const aLead = den[0];
  for (let i = 0; i < den.length; i++) den[i] /= aLead;
  for (let i = 0; i < num.length; i++) num[i] /= aLead;

  const n = den.length - 1; // order
  if (n === 0) {
    // Pure gain
    return { A: [], B: [], C: [], D: [[num[0] || 0]] };
  }

  // Direct term D and remainder for proper systems
  let D = 0;
  let numAdj = num.slice();
  if (num.length >= den.length) {
    if (num.length > den.length) throw new Error('Improper transfer function');
    D = num[0];
    // numAdj = num - D·den  (length matches den)
    numAdj = num.map((v, i) => v - D * den[i]);
    numAdj.shift(); // drop highest term (now zero)
  }
  // Pad numAdj on the LEFT with zeros to length n
  while (numAdj.length < n) numAdj.unshift(0);

  // den coefs from low to high: a_0 = den[n], a_1 = den[n-1], … , a_{n-1} = den[1]
  // den[0] is 1 (monic)
  const A: Matrix = mZeros(n, n);
  for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
  for (let j = 0; j < n; j++) A[n - 1][j] = -den[n - j];

  const B: Matrix = mZeros(n, 1);
  B[n - 1][0] = 1;

  // C: bring numAdj from high→low into low→high, since we want bᵢ where i is power of s
  // numAdj is high→low across degrees (n-1) → 0
  // We want C = [b_0, b_1, …, b_{n-1}]
  const numLowFirst = numAdj.slice().reverse();
  const C: Matrix = [numLowFirst];

  const Dm: Matrix = [[D]];
  return { A, B, C, D: Dm };
}

/* ---------- SS → TF ---------- */
/**
 * G(s) = C·adj(sI-A)·B / det(sI-A) + D
 *
 * For SISO: det(sI-A) is the characteristic polynomial (length n+1).
 * The numerator equals det(sI-A) for the same A with B in the position of one column
 * (Leverrier method): use B_k recursion or Faddeev to get numerator polynomial.
 *
 * Simpler approach: compute G(s_k) at n+1 distinct sample points and interpolate.
 */
export function stateSpaceToTf(ss: StateSpace): TransferFunction {
  const A = ss.A;
  const B = ss.B;
  const C = ss.C;
  const D = ss.D;
  const n = A.length;

  if (n === 0) {
    const g = D[0]?.[0] ?? 0;
    return { numerator: [g], denominator: [1], display: `${g}` };
  }
  const denom = charPoly(A); // monic, length n+1, high→low

  // Numerator obtained via Faddeev–LeVerrier recursion for resolvent (sI-A)^-1
  // (sI-A)^-1 = (1/det) · Σ_{k=0..n-1} M_k s^{n-1-k}
  // with M_0 = I, M_k = A·M_{k-1} + c_k·I , c_k = -tr(A·M_{k-1})/k.
  //
  // So numerator polynomial N(s) (for C·adj(sI-A)·B / det) has coefficient at s^{n-1-k}
  // equal to (C · M_k · B)[0][0].  D adds D·det(sI-A) to the numerator.

  let M: Matrix = mZeros(n, n);
  for (let i = 0; i < n; i++) M[i][i] = 1; // identity
  const numCoef: number[] = new Array(n).fill(0); // s^{n-1} … s^0

  for (let k = 0; k < n; k++) {
    // entry s^{n-1-k}
    const cmb = mMul(mMul(C, M), B);
    numCoef[k] = cmb[0]?.[0] ?? 0;
    if (k === n - 1) break;
    const AM = mMul(A, M);
    let tr = 0;
    for (let i = 0; i < n; i++) tr += AM[i][i];
    const ckp1 = -tr / (k + 1);
    M = AM.map((row, i) => row.map((v, j) => v + (i === j ? ckp1 : 0)));
  }

  // numCoef is high→low (s^{n-1} first), but TF format expects same length as polys (high→low)
  // Add D · denom for the direct term.
  const dVal = D[0]?.[0] ?? 0;
  let numerator: Polynomial;
  if (dVal === 0) {
    // Result is numCoef (degree n-1)
    numerator = numCoef.slice();
  } else {
    // numerator = D·denom + [0, numCoef]
    numerator = denom.map((v) => v * dVal);
    for (let i = 0; i < numCoef.length; i++) {
      numerator[i + 1] += numCoef[i];
    }
  }

  return {
    numerator,
    denominator: denom,
    display: 'C(sI−A)^{-1}B + D',
  };
}

/* ---------- Controllability ---------- */

export function controllabilityMatrix(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const cols = B[0].length;
  const Q: Matrix = mZeros(n, n * cols);
  // Q = [B  AB  A²B …]
  let block: Matrix = B.map((row) => row.slice());
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < cols; j++) Q[i][k * cols + j] = block[i][j];
    }
    block = mMul(A, block);
  }
  return Q;
}

export function isControllable(A: Matrix, B: Matrix): {
  matrix: Matrix;
  rank: number;
  controllable: boolean;
} {
  const Q = controllabilityMatrix(A, B);
  const r = mRank(Q);
  return { matrix: Q, rank: r, controllable: r === A.length };
}

/* ---------- Observability ---------- */

export function observabilityMatrix(A: Matrix, C: Matrix): Matrix {
  const n = A.length;
  const rows = C.length;
  const O: Matrix = mZeros(n * rows, n);
  let block: Matrix = C.map((row) => row.slice());
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < n; j++) O[k * rows + i][j] = block[i][j];
    }
    block = mMul(block, A);
  }
  return O;
}

export function isObservable(A: Matrix, C: Matrix): {
  matrix: Matrix;
  rank: number;
  observable: boolean;
} {
  const O = observabilityMatrix(A, C);
  const r = mRank(O);
  return { matrix: O, rank: r, observable: r === A.length };
}

/* ---------- State Transition Matrix ---------- */

export function stateTransitionMatrix(A: Matrix, t: number): Matrix {
  return expm(A, t);
}

/* ---------- Eigenvalues (poles) of state matrix ---------- */

export function stateSpaceEigenvalues(A: Matrix) {
  return eigenvalues(A);
}

/* ---------- Parse a state-space spec from text ---------- */

/**
 * Parse a state-space specification given as `A=[[...],[...]]; B=[[...]]; C=[[...]]; D=[[...]]`
 * or as separate lines like `A = [[0, 1], [-2, -3]]`. Whitespace is ignored.
 */
export function parseStateSpace(text: string): StateSpace {
  function matchMatrix(letter: string): Matrix | null {
    const re = new RegExp(`${letter}\\s*=\\s*(\\[[^A-Za-z]*?\\]\\s*\\])`, 'i');
    const m = text.match(re);
    if (!m) return null;
    try {
      // Strict JSON-like parse: replace ; with , and parse rows of bracketed lists
      const raw = m[1].replace(/\s+/g, '').replace(/;/g, ',');
      const inner = raw.slice(1, -1); // drop outer brackets
      const rows: number[][] = [];
      let depth = 0;
      let cur = '';
      for (const ch of inner) {
        if (ch === '[') { depth++; if (depth === 1) cur = ''; else cur += ch; }
        else if (ch === ']') { depth--; if (depth === 0) rows.push(cur.split(',').map(Number)); else cur += ch; }
        else { if (depth >= 1) cur += ch; }
      }
      if (rows.length === 0) return null;
      return rows;
    } catch {
      return null;
    }
  }
  const A = matchMatrix('A');
  const B = matchMatrix('B');
  const C = matchMatrix('C');
  const D = matchMatrix('D');
  if (!A) throw new Error('A matrix not found');
  if (!B) throw new Error('B matrix not found');
  if (!C) throw new Error('C matrix not found');
  const Dfinal: Matrix = D ?? C.map(() => new Array(B[0].length).fill(0));
  return { A, B, C, D: Dfinal };
}

/* ---------- Helpers ---------- */
export { polyMul };
