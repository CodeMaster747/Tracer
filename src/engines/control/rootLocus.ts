/**
 * Root locus construction for the closed-loop characteristic equation
 *   1 + K·G(s)·H(s) = 0   ⇒   den(s) + K·num(s) = 0
 *
 * Strategy: vary K logarithmically (plus a few extra dense ranges around break-aways
 * and jω crossings) and solve the polynomial den(s) + K·num(s) = 0 each step.
 * Match the roots between adjacent steps by nearest-neighbour assignment to keep
 * branches continuous.
 */
import type { TransferFunction } from './controlTypes';
import type { RootLocusResult } from './controlTypes';
import {
  polyRoots,
  type Polynomial,
  type Complex,
  cAbs,
  polyDerivative,
} from './polynomial';

function pad(p: Polynomial, n: number): Polynomial {
  // ensures length n by left-padding with zeros (high-order zeros)
  const out = p.slice();
  while (out.length < n) out.unshift(0);
  return out;
}

function polyAddScaled(den: Polynomial, num: Polynomial, k: number): Polynomial {
  const n = Math.max(den.length, num.length);
  const d = pad(den, n);
  const x = pad(num, n);
  return d.map((v, i) => v + k * x[i]);
}

function matchRoots(prev: Complex[], next: Complex[]): Complex[] {
  // Hungarian-style greedy match: for each prev root pick nearest unused next root.
  const used = new Array(next.length).fill(false);
  const out = new Array(prev.length).fill(null);
  const order = prev.map((_, i) => i);
  // Order by complexity of pairing — match the most isolated first
  order.sort((a, b) => {
    const da = next.reduce((s, r) => s + 1 / Math.max(1e-9, dist(prev[a], r)), 0);
    const db = next.reduce((s, r) => s + 1 / Math.max(1e-9, dist(prev[b], r)), 0);
    return da - db;
  });
  for (const i of order) {
    let bestJ = -1;
    let bestD = Infinity;
    for (let j = 0; j < next.length; j++) {
      if (used[j]) continue;
      const d = dist(prev[i], next[j]);
      if (d < bestD) { bestD = d; bestJ = j; }
    }
    if (bestJ >= 0) { used[bestJ] = true; out[i] = next[bestJ]; }
  }
  return out;
}

function dist(a: Complex, b: Complex): number {
  return Math.hypot(a.re - b.re, a.im - b.im);
}

export function buildRootLocus(tf: TransferFunction, opts?: { kMax?: number; samples?: number }): RootLocusResult {
  const num = tf.numerator.slice();
  const den = tf.denominator.slice();

  const poles = polyRoots(den);
  const zeros = polyRoots(num);
  const n = den.length - 1;
  const m = num.length - 1;

  // Asymptote analysis
  const numFiniteAsymptotes = Math.max(0, n - m);
  const asymAngles: number[] = [];
  for (let q = 0; q < numFiniteAsymptotes; q++) {
    const ang = ((2 * q + 1) * Math.PI) / numFiniteAsymptotes;
    asymAngles.push(ang);
  }
  const sumPoles = poles.reduce((a, p) => a + p.re, 0);
  const sumZeros = zeros.reduce((a, z) => a + z.re, 0);
  const centroid = numFiniteAsymptotes > 0 ? (sumPoles - sumZeros) / numFiniteAsymptotes : 0;

  // Sample gains
  const kMax = opts?.kMax ?? estimateKMax(tf);
  const samples = opts?.samples ?? 300;
  const ks: number[] = [0];
  for (let i = 1; i < samples; i++) {
    const f = i / (samples - 1);
    // Mix of log + linear so we capture both small- and large-gain behavior
    const k = kMax * (Math.pow(10, f * 4 - 4) + f * 0.05);
    ks.push(k);
  }

  // Roots at each k, then match against previous step
  let prev = poles.slice();
  const branchesPts: Complex[][] = poles.map(() => []);
  for (let i = 0; i < poles.length; i++) branchesPts[i].push({ ...poles[i] });

  for (let s = 1; s < ks.length; s++) {
    const charPoly = polyAddScaled(den, num, ks[s]);
    let next = polyRoots(charPoly);
    if (next.length < prev.length) {
      // degree dropped — fill with the same root farther away
      while (next.length < prev.length) next.push({ re: 1e6, im: 0 });
    } else if (next.length > prev.length) {
      next = next.slice(0, prev.length);
    }
    next = matchRoots(prev, next);
    for (let i = 0; i < prev.length; i++) branchesPts[i].push({ ...next[i] });
    prev = next;
  }

  // Breakaway points: roots of d/ds[N(s)/D(s)] = 0  ⇒  N·D' = D·N'  ⇒  N·D' − D·N' = 0
  const Dprime = polyDerivative(den);
  const Nprime = polyDerivative(num);
  const lhs = polyMulSimple(num, Dprime);
  const rhs = polyMulSimple(den, Nprime);
  const diff = polyAddScaled(lhs, rhs, -1);
  const breakRoots = polyRoots(diff)
    .filter((r) => Math.abs(r.im) < 1e-3)
    .map((r) => r.re)
    .filter((x) => Number.isFinite(x) && Math.abs(x) < 100);

  // jω crossings: substitute s = jω, separate real/imag, solve simultaneously
  const jw = findJOmegaCrossings(num, den);

  return {
    branches: branchesPts,
    gains: ks,
    poles,
    zeros,
    asymptotes: { centroid, angles: asymAngles },
    breakaways: breakRoots,
    jwCrossings: jw,
  };
}

function polyMulSimple(a: Polynomial, b: Polynomial): Polynomial {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}

function estimateKMax(tf: TransferFunction): number {
  // Rough: 10× the magnitude of the largest pole/zero × 10
  let m = 1;
  for (const p of polyRoots(tf.denominator)) m = Math.max(m, cAbs(p));
  for (const z of polyRoots(tf.numerator)) m = Math.max(m, cAbs(z));
  return Math.max(20, m * 50);
}

/**
 * Find ω values where the closed-loop characteristic polynomial den(s)+K·num(s) has roots
 * on the jω axis. Algorithm: write den(jω) = Dr(ω) + j·Di(ω), num(jω) = Nr(ω) + j·Ni(ω),
 * Re and Im of [den + K·num] must both vanish ⇒
 *      Dr + K·Nr = 0
 *      Di + K·Ni = 0
 * Eliminate K: Dr·Ni − Di·Nr = 0; then back-solve K.
 */
function findJOmegaCrossings(num: Polynomial, den: Polynomial): { omega: number; gain: number }[] {
  // Build polynomials in ω (real) for Dr, Di, Nr, Ni.
  // For p(s) = sum p_k s^{n-k}, p(jω) splits as:
  //   k even degree → contributes to Re with sign (-1)^{deg/2}
  //   k odd degree  → contributes to Im with sign (-1)^{(deg-1)/2}
  function splitRealImag(p: Polynomial): { re: number[]; im: number[] } {
    const n = p.length - 1;
    const reCoef: number[] = [];
    const imCoef: number[] = [];
    for (let i = 0; i < p.length; i++) {
      const deg = n - i;
      const v = p[i];
      if (deg % 2 === 0) {
        const e = deg / 2;
        const idx = e;
        reCoef[idx] = (reCoef[idx] ?? 0) + (e % 2 === 0 ? v : -v);
      } else {
        const e = (deg - 1) / 2;
        const idx = e;
        imCoef[idx] = (imCoef[idx] ?? 0) + (e % 2 === 0 ? v : -v);
      }
    }
    return { re: reCoef.reverse(), im: imCoef.reverse() };
  }

  // re/im are polynomials in ω (after fold) — degree depends on parity.
  // Note: splitRealImag returns the polynomial in ω (high→low after reverse).
  const Dpart = splitRealImag(den);
  const Npart = splitRealImag(num);

  // Eliminator: Dr(ω)·Ni(ω) − Di(ω)·Nr(ω) = 0  (polynomial in ω with REAL coefs and EVEN powers)
  const a = polyMulSimple(Dpart.re, Npart.im);
  const b = polyMulSimple(Dpart.im, Npart.re);
  const E = polyAddScaled(a, b, -1);
  // Roots of E in ω (could be complex; keep real positive)
  const roots = polyRoots(E)
    .filter((r) => Math.abs(r.im) < 1e-6)
    .map((r) => r.re)
    .filter((x) => Number.isFinite(x) && Math.abs(x) > 1e-9 && Math.abs(x) < 1e5);

  // For each ω, back-solve K = -Dr/Nr (or -Di/Ni); pick the one with smaller denominator magnitude
  const out: { omega: number; gain: number }[] = [];
  for (const omega of roots) {
    const Dr = evalPoly(Dpart.re, omega);
    const Di = evalPoly(Dpart.im, omega);
    const Nr = evalPoly(Npart.re, omega);
    const Ni = evalPoly(Npart.im, omega);
    let K: number;
    if (Math.abs(Nr) > Math.abs(Ni)) K = -Dr / Nr;
    else if (Math.abs(Ni) > 1e-12) K = -Di / Ni;
    else continue;
    if (K > 0) out.push({ omega: Math.abs(omega), gain: K });
  }
  // dedup
  const seen = new Set<string>();
  return out
    .filter((c) => {
      const key = `${c.omega.toFixed(3)}|${c.gain.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.gain - b.gain);
}

function evalPoly(p: Polynomial, x: number): number {
  let acc = 0;
  for (const c of p) acc = acc * x + c;
  return acc;
}
