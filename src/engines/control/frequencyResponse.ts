/**
 * Frequency response analysis: Bode, Nyquist, Polar plots and stability margins.
 */
import type { TransferFunction } from './controlTypes';
import type { BodeResult, NyquistResult } from './controlTypes';
import { evalTfAtJOmega } from './transferFunction';
import { cAbs, cArg, polyRoots, type Complex } from './polynomial';

/* ---------- Frequency range estimation ---------- */
export function estimateFrequencyRange(tf: TransferFunction): { wMin: number; wMax: number } {
  const corners: number[] = [];
  for (const p of polyRoots(tf.denominator)) {
    const m = cAbs(p);
    if (m > 1e-9) corners.push(m);
  }
  for (const z of polyRoots(tf.numerator)) {
    const m = cAbs(z);
    if (m > 1e-9) corners.push(m);
  }
  if (corners.length === 0) return { wMin: 0.01, wMax: 100 };
  const minC = Math.min(...corners);
  const maxC = Math.max(...corners);
  return { wMin: minC / 100, wMax: maxC * 100 };
}

/* ---------- Bode + margins ---------- */
export function computeBode(tf: TransferFunction, samples = 400): BodeResult {
  const { wMin, wMax } = estimateFrequencyRange(tf);
  const omegas: number[] = [];
  const magsDb: number[] = [];
  const phasesDeg: number[] = [];
  for (let i = 0; i < samples; i++) {
    const f = i / (samples - 1);
    const om = wMin * Math.pow(wMax / wMin, f);
    const G = evalTfAtJOmega(tf, om);
    omegas.push(om);
    magsDb.push(20 * Math.log10(Math.max(cAbs(G), 1e-30)));
    phasesDeg.push(unwrappedPhase(G, phasesDeg[phasesDeg.length - 1]));
  }

  // Gain crossover (|G| = 1, i.e. magDb = 0)
  let wcg: number | null = null;
  for (let i = 1; i < omegas.length; i++) {
    if (magsDb[i - 1] * magsDb[i] < 0 || magsDb[i] === 0) {
      const t = magsDb[i - 1] / (magsDb[i - 1] - magsDb[i]);
      const lw = Math.log10(omegas[i - 1]) + t * (Math.log10(omegas[i]) - Math.log10(omegas[i - 1]));
      wcg = Math.pow(10, lw);
      break;
    }
  }
  // Phase crossover (phase = -180°)
  let wcp: number | null = null;
  for (let i = 1; i < omegas.length; i++) {
    const a = phasesDeg[i - 1] + 180;
    const b = phasesDeg[i] + 180;
    if (a * b < 0 || b === 0) {
      const t = a / (a - b);
      const lw = Math.log10(omegas[i - 1]) + t * (Math.log10(omegas[i]) - Math.log10(omegas[i - 1]));
      wcp = Math.pow(10, lw);
      break;
    }
  }

  let phaseMarginDeg: number | null = null;
  if (wcg !== null) {
    const Gw = evalTfAtJOmega(tf, wcg);
    let ph = (cArg(Gw) * 180) / Math.PI;
    while (ph > 180) ph -= 360;
    while (ph < -180) ph += 360;
    phaseMarginDeg = 180 + ph;
  }
  let gainMarginDb: number | null = null;
  if (wcp !== null) {
    const Gw = evalTfAtJOmega(tf, wcp);
    const m = cAbs(Gw);
    gainMarginDb = -20 * Math.log10(Math.max(m, 1e-30));
  }

  return { omegas, magsDb, phasesDeg, gainMarginDb, phaseMarginDeg, wcg, wcp };
}

function unwrappedPhase(z: Complex, prev?: number): number {
  let ph = (Math.atan2(z.im, z.re) * 180) / Math.PI;
  if (prev === undefined) return ph;
  while (ph - prev > 180) ph -= 360;
  while (ph - prev < -180) ph += 360;
  return ph;
}

/* ---------- Nyquist ---------- */
/**
 * The Nyquist contour traverses ω ∈ (0, ∞) along jω, then the half-circle at infinity,
 * then back ω ∈ (-∞, 0) (= conjugate of the first half). For plotting we sample
 * the positive branch; the user can mirror it visually. Encirclement count is computed
 * using the winding number around (-1, 0).
 */
export function computeNyquist(tf: TransferFunction, samples = 400): NyquistResult {
  const { wMin, wMax } = estimateFrequencyRange(tf);
  const omegas: number[] = [];
  const values: Complex[] = [];
  for (let i = 0; i < samples; i++) {
    const f = i / (samples - 1);
    const om = wMin * Math.pow(wMax / wMin, f);
    omegas.push(om);
    values.push(evalTfAtJOmega(tf, om));
  }
  // build full contour for winding number: negative ω = conjugate of positive
  const fullPath: Complex[] = [];
  for (let i = values.length - 1; i >= 0; i--) {
    fullPath.push({ re: values[i].re, im: -values[i].im });
  }
  for (let i = 0; i < values.length; i++) fullPath.push(values[i]);

  const enc = windingNumber(fullPath, { re: -1, im: 0 });
  const rhpOpen = polyRoots(tf.denominator).filter((p) => p.re > 1e-9).length;
  // Nyquist criterion: Z = N + P where Z = closed-loop RHP poles,
  // N = clockwise encirclements (so we negate our CCW winding number)
  const N_cw = -enc;
  const Z = N_cw + rhpOpen;

  const bode = computeBode(tf, Math.min(samples, 200));
  return {
    omegas,
    values,
    gainMarginDb: bode.gainMarginDb,
    phaseMarginDeg: bode.phaseMarginDeg,
    encirclements: N_cw,
    rhpOpenLoopPoles: rhpOpen,
    closedLoopRhpPoles: Math.max(0, Z),
    stable: Z === 0,
  };
}

/**
 * Approximate winding number of a closed polyline around a point.
 * Sums angular increments and divides by 2π.
 */
function windingNumber(path: Complex[], around: Complex): number {
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const aa = Math.atan2(a.im - around.im, a.re - around.re);
    const bb = Math.atan2(b.im - around.im, b.re - around.re);
    let d = bb - aa;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
  }
  return Math.round(total / (2 * Math.PI));
}

/* ---------- Polar plot ---------- */

export function computePolar(tf: TransferFunction, samples = 200) {
  const { wMin, wMax } = estimateFrequencyRange(tf);
  const omegas: number[] = [];
  const values: Complex[] = [];
  for (let i = 0; i < samples; i++) {
    const f = i / (samples - 1);
    const om = wMin * Math.pow(wMax / wMin, f);
    omegas.push(om);
    values.push(evalTfAtJOmega(tf, om));
  }
  return { omegas, values };
}
