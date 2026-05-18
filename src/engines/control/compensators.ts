/**
 * PID and series compensator design (P, PI, PD, PID, Lead, Lag, Lead-Lag).
 *
 * All compensators return a TransferFunction Gc(s).  Some also expose the
 * design parameters that produced them.
 */
import type { TransferFunction, Polynomial } from './controlTypes';
import { polyMul } from './polynomial';

/* ---------- Pure proportional ---------- */
export function P(Kp: number): TransferFunction {
  return { numerator: [Kp], denominator: [1], display: `${Kp}` };
}

/* ---------- PI ---------- */
export function PI(Kp: number, Ki: number): TransferFunction {
  // Kp + Ki/s = (Kp s + Ki)/s
  return { numerator: [Kp, Ki], denominator: [1, 0], display: `${Kp} + ${Ki}/s` };
}

/* ---------- PD ---------- */
export function PD(Kp: number, Kd: number): TransferFunction {
  return { numerator: [Kd, Kp], denominator: [1], display: `${Kp} + ${Kd}s` };
}

/* ---------- PID ---------- */
/**
 * Standard parallel form:  Kp + Ki/s + Kd s = (Kd s² + Kp s + Ki) / s
 *
 * Optional N parameter (default 0) adds the realizable derivative filter
 *   Kd · N / (1 + N/s) form is also supported when N > 0:
 *     Gc(s) = Kp + Ki/s + Kd N s / (s + N)
 * giving Gc(s) = (Kp(s+N)·s + Ki(s+N) + Kd N s²) / (s(s+N)).
 */
export function PID(Kp: number, Ki: number, Kd: number, N = 0): TransferFunction {
  if (N <= 0) {
    return {
      numerator: [Kd, Kp, Ki],
      denominator: [1, 0],
      display: `${Kp} + ${Ki}/s + ${Kd}s`,
    };
  }
  // Realizable PID
  // Num: Kp s(s+N) + Ki (s+N) + Kd N s² = (Kp + Kd N) s² + (Kp N + Ki) s + Ki N
  const a2 = Kp + Kd * N;
  const a1 = Kp * N + Ki;
  const a0 = Ki * N;
  return {
    numerator: [a2, a1, a0],
    denominator: [1, N, 0],
    display: `${Kp} + ${Ki}/s + ${Kd}Ns/(s+${N})`,
  };
}

/* ---------- Lead compensator ---------- */
/**
 *   Gc(s) = Kc · (s + z) / (s + p)        with z < p   (lead → zero closer to origin)
 *
 * Design from desired maximum phase lead φm and crossover frequency ωm.
 *   α = (1 − sin φm) / (1 + sin φm)
 *   T = 1/(ωm √α)
 *   z = 1/T,   p = 1/(αT)
 * Kc chosen so |Gc(jωm)| = 1/√α  (a typical convention), but caller can override.
 */
export interface LeadDesign {
  phiMaxDeg: number;
  omegaM: number;
  Kc?: number;
}
export interface LagDesign {
  beta: number;    // > 1
  omegaPlace: number;
  Kc?: number;
}

export function designLead(spec: LeadDesign): { tf: TransferFunction; params: { alpha: number; T: number; z: number; p: number; Kc: number } } {
  const phi = (spec.phiMaxDeg * Math.PI) / 180;
  const alpha = (1 - Math.sin(phi)) / (1 + Math.sin(phi));
  if (alpha <= 0) throw new Error('Lead compensator: phi must be in (0°, 90°).');
  const T = 1 / (spec.omegaM * Math.sqrt(alpha));
  const z = 1 / T;
  const p = 1 / (alpha * T);
  const Kc = spec.Kc ?? 1 / Math.sqrt(alpha);
  return {
    tf: {
      numerator: [Kc, Kc * z],
      denominator: [1, p],
      display: `${Kc} · (s + ${z.toFixed(3)}) / (s + ${p.toFixed(3)})`,
    },
    params: { alpha, T, z, p, Kc },
  };
}

export function designLag(spec: LagDesign): { tf: TransferFunction; params: { beta: number; T: number; z: number; p: number; Kc: number } } {
  if (spec.beta <= 1) throw new Error('Lag compensator: β must be > 1.');
  // Place zero ~ a decade below ωplace
  const T = 10 / spec.omegaPlace;
  const z = 1 / T;
  const p = 1 / (spec.beta * T);
  const Kc = spec.Kc ?? 1;
  return {
    tf: {
      numerator: [Kc, Kc * z],
      denominator: [1, p],
      display: `${Kc} · (s + ${z.toFixed(3)}) / (s + ${p.toFixed(3)})`,
    },
    params: { beta: spec.beta, T, z, p, Kc },
  };
}

export function designLeadLag(leadSpec: LeadDesign, lagSpec: LagDesign): { tf: TransferFunction; lead: ReturnType<typeof designLead>; lag: ReturnType<typeof designLag> } {
  const lead = designLead(leadSpec);
  const lag = designLag(lagSpec);
  const num: Polynomial = polyMul(lead.tf.numerator, lag.tf.numerator);
  const den: Polynomial = polyMul(lead.tf.denominator, lag.tf.denominator);
  return {
    tf: { numerator: num, denominator: den, display: `Lead·Lag = (${lead.tf.display}) · (${lag.tf.display})` },
    lead,
    lag,
  };
}

/* ---------- Ziegler-Nichols PID tuning ---------- */
/**
 * Heuristic tuning based on ultimate-gain method:
 *   Kp = 0.6 · Ku
 *   Ki = 2  · Kp / Tu
 *   Kd = Kp · Tu / 8
 */
export function zieglerNicholsPID(Ku: number, Tu: number): TransferFunction & { params: { Kp: number; Ki: number; Kd: number } } {
  const Kp = 0.6 * Ku;
  const Ki = (2 * Kp) / Tu;
  const Kd = (Kp * Tu) / 8;
  return Object.assign(PID(Kp, Ki, Kd), { params: { Kp, Ki, Kd } });
}

/**
 * Reaction-curve (Process Reaction) Z-N tuning given the process model
 *   K · exp(-Ld·s) / (τ·s + 1)
 */
export function zieglerNicholsReactionPID(K: number, tau: number, L: number) {
  const Kp = 1.2 * (tau / (K * L));
  const Ti = 2 * L;
  const Td = 0.5 * L;
  return Object.assign(PID(Kp, Kp / Ti, Kp * Td), { params: { Kp, Ki: Kp / Ti, Kd: Kp * Td } });
}
