/**
 * Time-domain response of LTI systems.
 *
 * Strategy: convert TF → controllable canonical state-space, then integrate
 *   dx/dt = A·x + B·u(t)
 *   y    = C·x + D·u(t)
 * using exact zero-order-hold matrix exponential.
 *
 * For step input we use ZOH:
 *   x[k+1] = exp(A·dt)·x[k] + (∫exp(A·s)ds · B)·u[k]
 * which for piecewise-constant u is exact.
 *
 * For impulse we excite x[0] = B (since impulse drives the integrator to dump B suddenly),
 * and y(t) = C·exp(A·t)·B + D·δ(t).
 *
 * For ramp input r(t)=A·t, augment the system with an integrator state.
 */
import type { TransferFunction } from './controlTypes';
import { tfToStateSpaceCCF } from './stateSpace';
import { expm, mMul, mAdd, mScale, mInverse, mIdentity, type Matrix } from './matrix';
import { polyRoots, type Complex } from './polynomial';

export interface TimeResponseResult {
  ts: number[];
  ys: number[];
  inputType: 'step' | 'impulse' | 'ramp';
  inputAmplitude: number;
  /** Performance metrics — fields populated based on input type & order */
  metrics: TimeResponseMetrics;
}

export interface TimeResponseMetrics {
  /** Final value of y (steady state) */
  yFinal?: number;
  /** Peak value for underdamped step */
  yPeak?: number;
  /** Time at peak */
  tPeak?: number;
  /** Percent overshoot */
  overshoot?: number;
  /** Rise time (10–90 %) */
  riseTime?: number;
  /** 2 % settling time */
  settlingTime2?: number;
  /** 5 % settling time */
  settlingTime5?: number;
  /** Delay time (50 %) */
  delayTime?: number;
  /** Steady-state error for the given test input */
  steadyStateError?: number;
  /** Damped natural frequency wd (rad/s) */
  wd?: number;
  /** System classification */
  classification?: string;
}

/* ---------- Auto duration selection ---------- */
function chooseDuration(tf: TransferFunction, inputType: 'step' | 'impulse' | 'ramp'): number {
  const poles = polyRoots(tf.denominator);
  let slowest = 0.1;
  for (const p of poles) {
    if (p.re < -1e-9) {
      const ts = 4 / Math.abs(p.re); // ≈ 2 % settling for that mode
      if (ts > slowest) slowest = ts;
    } else if (Math.abs(p.im) > 1e-9) {
      const T = (2 * Math.PI) / Math.abs(p.im);
      if (T * 5 > slowest) slowest = T * 5;
    }
  }
  let duration = slowest * 1.2;
  if (inputType === 'ramp') duration = Math.max(duration, slowest * 1.6);
  return Math.min(Math.max(duration, 1), 200);
}

/* ---------- Core integrator ---------- */

/**
 * Simulate the SISO system with ZOH input u(t) over given time array.
 */
function simulateZOH(
  A: Matrix,
  B: Matrix,
  C: Matrix,
  D: Matrix,
  uFunc: (t: number) => number,
  ts: number[],
  x0: Matrix
): number[] {
  const n = A.length;
  const ys = new Array(ts.length).fill(0);
  let x = x0;
  if (n === 0) {
    // pure-gain system
    const d = D[0]?.[0] ?? 0;
    for (let k = 0; k < ts.length; k++) ys[k] = d * uFunc(ts[k]);
    return ys;
  }
  // y(0)
  ys[0] = (mMul(C, x)[0]?.[0] ?? 0) + (D[0]?.[0] ?? 0) * uFunc(ts[0]);
  for (let k = 1; k < ts.length; k++) {
    const dt = ts[k] - ts[k - 1];
    const Phi = expm(A, dt);
    // Discrete input matrix Γ ≈ A^-1 (Phi - I) B  when A is invertible.
    // Fallback to numerical integration of ∫₀^dt exp(A·s) ds · B otherwise.
    let Gamma: Matrix;
    try {
      const I = mIdentity(n);
      const Ainv = mInverse(A);
      Gamma = mMul(mMul(Ainv, mAdd(Phi, mScale(I, -1))), B);
    } catch {
      // Trapezoidal: average exp values across small substeps
      const N = 10;
      const dtSub = dt / N;
      const acc: Matrix = new Array(n).fill(0).map(() => [0]);
      for (let s = 0; s < N; s++) {
        const tau = (s + 0.5) * dtSub;
        const E = expm(A, tau);
        const term = mMul(E, B);
        for (let i = 0; i < n; i++) acc[i][0] += term[i][0] * dtSub;
      }
      Gamma = acc;
    }
    const u = uFunc(ts[k - 1]);
    const xNew = mAdd(mMul(Phi, x), mScale(Gamma, u));
    x = xNew;
    ys[k] = (mMul(C, x)[0]?.[0] ?? 0) + (D[0]?.[0] ?? 0) * uFunc(ts[k]);
  }
  return ys;
}

/* ---------- Public entry ---------- */

export function computeTimeResponse(
  tf: TransferFunction,
  spec: { inputType: 'step' | 'impulse' | 'ramp'; amplitude?: number; duration?: number; samples?: number }
): TimeResponseResult {
  const amp = spec.amplitude ?? 1;
  const duration = spec.duration ?? chooseDuration(tf, spec.inputType);
  const samples = spec.samples ?? 400;
  const ts: number[] = [];
  for (let i = 0; i < samples; i++) ts.push((i * duration) / (samples - 1));

  const ss = tfToStateSpaceCCF(tf);
  const n = ss.A.length;
  let ys: number[];

  if (spec.inputType === 'step') {
    const x0: Matrix = new Array(n).fill(0).map(() => [0]);
    ys = simulateZOH(ss.A, ss.B, ss.C, ss.D, () => amp, ts, x0);
  } else if (spec.inputType === 'impulse') {
    // x0 = amp · B; u(t) = 0 thereafter
    const x0: Matrix = ss.B.map((row) => [row[0] * amp]);
    ys = simulateZOH(ss.A, ss.B, ss.C, ss.D, () => 0, ts, x0);
    // include D·δ(t) by augmenting first sample
    const d = ss.D[0]?.[0] ?? 0;
    if (d !== 0) ys[0] += d * amp / (ts[1] - ts[0]); // delta approximation
  } else {
    // ramp = amp · t
    const x0: Matrix = new Array(n).fill(0).map(() => [0]);
    ys = simulateZOH(ss.A, ss.B, ss.C, ss.D, (t) => amp * t, ts, x0);
  }

  const metrics = computeMetrics(tf, ts, ys, spec.inputType, amp);
  return { ts, ys, inputType: spec.inputType, inputAmplitude: amp, metrics };
}

/* ---------- Metrics ---------- */

function computeMetrics(
  tf: TransferFunction,
  ts: number[],
  ys: number[],
  inputType: 'step' | 'impulse' | 'ramp',
  amp: number
): TimeResponseMetrics {
  const out: TimeResponseMetrics = {};
  const N = ts.length;
  const yFinal = ys[N - 1];
  out.yFinal = yFinal;

  if (inputType === 'step') {
    // DC gain estimate
    const dcGain = evalAtZero(tf); // G(0)
    const expectedFinal = dcGain * amp;
    out.steadyStateError = amp - expectedFinal; // for unity feedback this is e_ss for step; in open-loop it's a reference
    // Peak
    let iPeak = 0;
    for (let i = 1; i < N; i++) if (ys[i] > ys[iPeak]) iPeak = i;
    out.yPeak = ys[iPeak];
    out.tPeak = ts[iPeak];
    const ssVal = expectedFinal;
    if (Math.abs(ssVal) > 1e-12) {
      out.overshoot = ((out.yPeak - ssVal) / ssVal) * 100;
      if (out.overshoot < 0.05) out.overshoot = 0;
    }
    // Rise time 10–90 %
    const t10 = firstCross(ys, ts, 0.1 * ssVal);
    const t90 = firstCross(ys, ts, 0.9 * ssVal);
    if (t10 !== null && t90 !== null) out.riseTime = t90 - t10;
    // Settling 2 % & 5 %
    out.settlingTime2 = lastTimeOutsideBand(ys, ts, ssVal, 0.02);
    out.settlingTime5 = lastTimeOutsideBand(ys, ts, ssVal, 0.05);
    // Delay 50 %
    const t50 = firstCross(ys, ts, 0.5 * ssVal);
    if (t50 !== null) out.delayTime = t50;

    // Classification (for 2nd order)
    const poles = polyRoots(tf.denominator);
    if (poles.length === 2 && poles.every((p) => Math.abs(p.im) > 0)) {
      const zeta = -poles[0].re / Math.hypot(poles[0].re, poles[0].im);
      if (zeta <= 0) out.classification = 'undamped/unstable';
      else if (zeta < 1) out.classification = 'underdamped';
      else if (Math.abs(zeta - 1) < 1e-6) out.classification = 'critically damped';
      else out.classification = 'overdamped';
      out.wd = Math.abs(poles[0].im);
    } else if (poles.length === 1) {
      out.classification = '1st-order';
    }
  } else if (inputType === 'impulse') {
    out.yPeak = Math.max(...ys);
  } else {
    // ramp: ss error = error between input ramp and output (asymptotic slope difference)
    const t = ts[N - 1];
    const e = amp * t - ys[N - 1];
    out.steadyStateError = e;
  }
  return out;
}

function firstCross(ys: number[], ts: number[], target: number): number | null {
  for (let i = 1; i < ys.length; i++) {
    if ((ys[i - 1] - target) * (ys[i] - target) <= 0) {
      const f = (target - ys[i - 1]) / (ys[i] - ys[i - 1] || 1);
      return ts[i - 1] + f * (ts[i] - ts[i - 1]);
    }
  }
  return null;
}

function lastTimeOutsideBand(ys: number[], ts: number[], ssVal: number, frac: number): number | undefined {
  if (Math.abs(ssVal) < 1e-12) return undefined;
  const tol = Math.abs(ssVal) * frac;
  for (let i = ys.length - 1; i >= 0; i--) {
    if (Math.abs(ys[i] - ssVal) > tol) return ts[i];
  }
  return 0;
}

function evalAtZero(tf: TransferFunction): number {
  const num = tf.numerator[tf.numerator.length - 1] ?? 0;
  const den = tf.denominator[tf.denominator.length - 1] ?? 1;
  if (den === 0) return Infinity;
  return num / den;
}

/* ---------- 2nd order analytic helpers ---------- */
/**
 * Identifies (K, ωn, ζ) of a system represented as K·ωn² / (s² + 2ζωn s + ωn²).
 * Returns null if the system is not strictly 2nd-order proper.
 */
export function identifySecondOrder(tf: TransferFunction): { wn: number; zeta: number; K: number } | null {
  if (tf.denominator.length !== 3) return null;
  const [a, b, c] = tf.denominator;
  if (a === 0) return null;
  const a0 = b / a;
  const a1 = c / a;
  if (a1 <= 0) return null;
  const wn = Math.sqrt(a1);
  const zeta = a0 / (2 * wn);
  // K from G(0) / 1  (assume strictly proper)
  const num = tf.numerator;
  const K = (num[num.length - 1] ?? 0) / c;
  return { wn, zeta, K };
}

export function identifyFirstOrder(tf: TransferFunction): { tau: number; K: number } | null {
  if (tf.denominator.length !== 2) return null;
  const [a, b] = tf.denominator;
  if (a === 0 || b === 0) return null;
  const tau = a / b;
  const K = (tf.numerator[tf.numerator.length - 1] ?? 0) / b;
  return { tau, K };
}

export function classifyPolesByDamping(poles: Complex[]): string {
  if (poles.length === 0) return 'no poles';
  let rhp = 0, lhp = 0, axis = 0;
  for (const p of poles) {
    if (p.re > 1e-10) rhp++;
    else if (p.re < -1e-10) lhp++;
    else axis++;
  }
  if (rhp > 0) return `unstable (${rhp} RHP pole${rhp > 1 ? 's' : ''})`;
  if (axis > 0) return `marginally stable (${axis} pole${axis > 1 ? 's' : ''} on jω-axis)`;
  return 'asymptotically stable';
}
