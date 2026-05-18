/**
 * Central dispatcher for the Control Systems engine.
 *
 * Routes parsed questions to the appropriate analysis module and renders the
 * combined result as a multi-section ControlDoc.
 */
import type { SolverResult } from '@/engines/types';
import { paperSpec } from '@/engines/types';

import { parseControlQuestion, type ParsedQuestion, type ControlTopic } from './parser';
import { controlMetaFromDoc, isControlDiagramSection } from './meta';
import { polyToString, type Complex } from './polynomial';
import { type TransferFunction, getPoles, getZeros } from './transferFunction';
import type { ControlDoc, ControlSection } from './controlTypes';
import { renderControlDoc } from './controlLayout';
import { routhArray } from './routh';
import { computeBode, computeNyquist, computePolar } from './frequencyResponse';
import { buildRootLocus } from './rootLocus';
import { computeTimeResponse, identifyFirstOrder, identifySecondOrder, classifyPolesByDamping } from './timeResponse';
import {
  tfToStateSpaceCCF,
  stateSpaceToTf,
  controllabilityMatrix,
  observabilityMatrix,
  isControllable,
  isObservable,
  stateTransitionMatrix,
} from './stateSpace';
import { reduceBlockDiagram, feedback as fbReduce } from './blockDiagram';
import { masonsGain, specToGraph } from './signalFlowGraph';
import {
  P, PI, PD, PID,
  designLead, designLag, designLeadLag,
  zieglerNicholsPID,
} from './compensators';
import {
  massSpringDamper, rotationalPosition,
  rlcSeriesAcrossC,
  dcMotorPosition, dcMotorVelocity,
  ANALOGOUS_TABLE,
  positionServoOpenLoop,
} from './modeling';

/* ============================================================ */
/* Helpers                                                       */
/* ============================================================ */

function fmtNum(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  if (Math.abs(x) < 1e-12) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  if (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e4) return x.toExponential(2);
  return Number(x.toPrecision(4)).toString();
}
function fmtCx(z: Complex): string {
  if (Math.abs(z.im) < 1e-9) return fmtNum(z.re);
  if (Math.abs(z.re) < 1e-9) return `${fmtNum(z.im)}j`;
  const sign = z.im >= 0 ? '+' : '-';
  return `${fmtNum(z.re)} ${sign} ${fmtNum(Math.abs(z.im))}j`;
}
function fmtTf(tf: TransferFunction): string {
  return `(${polyToString(tf.numerator)}) / (${polyToString(tf.denominator)})`;
}

function refusal(reason: string, manualInstructions: string[]): SolverResult {
  return {
    success: false,
    summary: reason,
    paper: paperSpec('A3', 'landscape'),
    strokes: [],
    refusalReason: reason,
    manualInstructions,
  };
}

function packageDoc(doc: ControlDoc): SolverResult {
  // The paper canvas shows only diagram-kind sections; equations, matrices,
  // tables, prose all flow into the sidebar via meta.
  const diagramDoc: ControlDoc = {
    title: '',
    summary: '',
    sections: doc.sections.filter(isControlDiagramSection),
  };
  const { strokes, paperWidthMm, paperHeightMm } = renderControlDoc(diagramDoc);
  // Choose closest stock paper that fits height
  const orient = 'landscape' as const;
  const paper =
    paperHeightMm > 297
      ? { size: 'A2' as const, orientation: orient, widthMm: paperWidthMm, heightMm: paperHeightMm }
      : paperSpec('A3', orient);
  return { success: true, summary: doc.summary, paper, strokes };
}

/* ============================================================ */
/* Per-topic solvers                                             */
/* ============================================================ */

function solvePoleZero(tf: TransferFunction): ControlDoc {
  const poles = getPoles(tf);
  const zeros = getZeros(tf);
  return {
    title: 'Pole-Zero Plot',
    summary: `G(s) = ${fmtTf(tf)}. Poles: ${poles.map(fmtCx).join(', ') || 'none'}. Zeros: ${zeros.map(fmtCx).join(', ') || 'none'}. System is ${classifyPolesByDamping(poles)}.`,
    sections: [
      { kind: 'equation', title: 'Transfer function', lines: [`G(s) = ${fmtTf(tf)}`] },
      {
        kind: 'text',
        title: 'Step-by-step',
        lines: [
          '1. Factor the denominator to find poles (denominator roots).',
          '2. Factor the numerator to find zeros (numerator roots).',
          '3. Plot poles as × and zeros as ○ on the s-plane.',
          '4. Examine the real parts: LHP ⇒ stable mode; RHP ⇒ unstable mode; jω-axis ⇒ marginally stable mode.',
        ],
      },
      { kind: 'pole-zero', title: 'Pole-Zero Map', poles, zeros },
      {
        kind: 'table',
        title: 'Root summary',
        headers: ['Type', 'Value', 'Re', 'Im', 'Magnitude'],
        rows: [
          ...zeros.map((z) => ['Zero', fmtCx(z), fmtNum(z.re), fmtNum(z.im), fmtNum(Math.hypot(z.re, z.im))]),
          ...poles.map((p) => ['Pole', fmtCx(p), fmtNum(p.re), fmtNum(p.im), fmtNum(Math.hypot(p.re, p.im))]),
        ],
      },
    ],
  };
}

function solveRouth(poly: number[], denomDisplay: string): ControlDoc {
  const r = routhArray(poly);
  const n = poly.length - 1;
  const rows: string[][] = r.rows.map((row, i) => [
    `s^${n - i}`,
    ...row.map((v) => (Number.isNaN(v) ? '·' : fmtNum(v))),
  ]);
  const cols = Math.max(...r.rows.map((r) => r.length));
  const headers = ['Row', ...Array(cols).fill(0).map((_, i) => `c${i + 1}`)];
  const conclusion = r.stable
    ? 'All first-column entries have the same sign → no RHP roots → STABLE.'
    : `${r.signChanges} sign change${r.signChanges === 1 ? '' : 's'} in the first column → ${r.signChanges} RHP root${r.signChanges === 1 ? '' : 's'} → UNSTABLE.`;
  return {
    title: 'Routh-Hurwitz Stability Test',
    summary: `Characteristic polynomial: ${denomDisplay}. ${conclusion}`,
    sections: [
      { kind: 'equation', title: 'Characteristic polynomial', lines: [`Δ(s) = ${denomDisplay}`] },
      {
        kind: 'text',
        title: 'Construction rules',
        lines: [
          '• Row s^n  : even-indexed coefficients (a_n, a_{n-2}, …).',
          '• Row s^{n-1}: odd-indexed coefficients (a_{n-1}, a_{n-3}, …).',
          '• Each subsequent row entry is computed from the two rows above as',
          '    −(1/p) · det([[a, b], [c, d]])  where p is the leading element of the row above.',
          '• Sign changes in the first column ⇒ number of RHP closed-loop poles.',
        ],
      },
      { kind: 'table', title: 'Routh array', headers, rows },
      { kind: 'text', title: 'Conclusion', lines: [conclusion] },
    ],
  };
}

function solveBode(tf: TransferFunction): ControlDoc {
  const b = computeBode(tf);
  const margins: string[] = [];
  if (b.gainMarginDb !== null) margins.push(`Gain margin = ${fmtNum(b.gainMarginDb)} dB at ω = ${fmtNum(b.wcp ?? 0)} rad/s`);
  else margins.push('Gain margin: ∞ (no phase crossover)');
  if (b.phaseMarginDeg !== null) margins.push(`Phase margin = ${fmtNum(b.phaseMarginDeg)}° at ω = ${fmtNum(b.wcg ?? 0)} rad/s`);
  else margins.push('Phase margin: undefined (no gain crossover)');
  return {
    title: 'Bode Plot',
    summary: `G(s) = ${fmtTf(tf)}.  ${margins.join('.  ')}.`,
    sections: [
      { kind: 'equation', title: 'Transfer function', lines: [`G(s) = ${fmtTf(tf)}`] },
      {
        kind: 'xy-plot',
        title: 'Magnitude (dB)',
        series: [{ xs: b.omegas, ys: b.magsDb, label: '|G(jω)| (dB)' }],
        xLabel: 'ω (rad/s)',
        yLabel: 'Magnitude (dB)',
        xLog: true,
        gridDecades: true,
        hlines: [{ y: 0, label: '0 dB', style: 'dashed' }],
        vlines: b.wcg ? [{ x: b.wcg, label: `ωcg=${fmtNum(b.wcg)}` }] : [],
      },
      {
        kind: 'xy-plot',
        title: 'Phase (deg)',
        series: [{ xs: b.omegas, ys: b.phasesDeg, label: '∠G(jω)' }],
        xLabel: 'ω (rad/s)',
        yLabel: 'Phase (deg)',
        xLog: true,
        gridDecades: true,
        hlines: [{ y: -180, label: '-180°', style: 'dashed' }],
        vlines: b.wcp ? [{ x: b.wcp, label: `ωcp=${fmtNum(b.wcp)}` }] : [],
      },
      {
        kind: 'table',
        title: 'Stability margins',
        headers: ['Quantity', 'Value', 'Crossover ω (rad/s)'],
        rows: [
          ['Gain margin', b.gainMarginDb !== null ? `${fmtNum(b.gainMarginDb)} dB` : '∞', b.wcp !== null ? fmtNum(b.wcp) : '—'],
          ['Phase margin', b.phaseMarginDeg !== null ? `${fmtNum(b.phaseMarginDeg)}°` : '—', b.wcg !== null ? fmtNum(b.wcg) : '—'],
        ],
      },
    ],
  };
}

function solveNyquist(tf: TransferFunction): ControlDoc {
  const ny = computeNyquist(tf);
  const status = ny.stable ? 'closed-loop STABLE' : `closed-loop UNSTABLE (${ny.closedLoopRhpPoles} RHP pole${ny.closedLoopRhpPoles === 1 ? '' : 's'})`;
  return {
    title: 'Nyquist Plot',
    summary: `G(s) = ${fmtTf(tf)}.  N (CW encirclements of -1) = ${ny.encirclements}; P (RHP open-loop poles) = ${ny.rhpOpenLoopPoles}; Z = N + P = ${ny.closedLoopRhpPoles}.  By the Nyquist criterion the system is ${status}.`,
    sections: [
      { kind: 'equation', title: 'Open-loop TF', lines: [`G(s)H(s) = ${fmtTf(tf)}`] },
      {
        kind: 'text',
        title: 'Nyquist criterion',
        lines: [
          'Trace G(jω) as ω goes 0 → ∞, then mirror conjugate for ω → −∞.',
          'Count CW encirclements (N) of the critical point (−1, 0).',
          'P = open-loop poles in the right-half-plane.',
          'Z = N + P = closed-loop poles in RHP.  System stable ⇔ Z = 0.',
        ],
      },
      {
        kind: 'polar',
        title: 'Nyquist Diagram',
        points: ny.values.map((v, i) => ({ re: v.re, im: v.im, omega: ny.omegas[i] })),
        includeUnitCircle: false,
        includeMinusOne: true,
      },
      {
        kind: 'table',
        title: 'Result',
        headers: ['Quantity', 'Value'],
        rows: [
          ['CW encirclements N', String(ny.encirclements)],
          ['Open-loop RHP poles P', String(ny.rhpOpenLoopPoles)],
          ['Closed-loop RHP poles Z = N + P', String(ny.closedLoopRhpPoles)],
          ['Gain margin (dB)', ny.gainMarginDb !== null ? fmtNum(ny.gainMarginDb) : '∞'],
          ['Phase margin (°)', ny.phaseMarginDeg !== null ? fmtNum(ny.phaseMarginDeg) : '—'],
          ['Stability', ny.stable ? 'Stable' : 'Unstable'],
        ],
      },
    ],
  };
}

function solvePolar(tf: TransferFunction): ControlDoc {
  const p = computePolar(tf);
  return {
    title: 'Polar Plot',
    summary: `Polar plot of G(jω) for ω from ${fmtNum(p.omegas[0])} to ${fmtNum(p.omegas[p.omegas.length - 1])} rad/s.`,
    sections: [
      { kind: 'equation', title: 'Transfer function', lines: [`G(s) = ${fmtTf(tf)}`] },
      {
        kind: 'polar',
        title: 'G(jω) locus',
        points: p.values.map((v, i) => ({ re: v.re, im: v.im, omega: p.omegas[i] })),
        annotateOmegas: pickAnnotationOmegas(p.omegas),
        includeUnitCircle: true,
      },
      {
        kind: 'table',
        title: 'Samples',
        headers: ['ω', '|G(jω)|', '∠G(jω)°', 'Re', 'Im'],
        rows: p.values
          .filter((_, i) => i % Math.max(1, Math.floor(p.values.length / 10)) === 0)
          .map((v, i) => {
            const idx = i * Math.max(1, Math.floor(p.values.length / 10));
            const mag = Math.hypot(v.re, v.im);
            const ph = (Math.atan2(v.im, v.re) * 180) / Math.PI;
            return [fmtNum(p.omegas[idx]), fmtNum(mag), fmtNum(ph), fmtNum(v.re), fmtNum(v.im)];
          }),
      },
    ],
  };
}

function pickAnnotationOmegas(omegas: number[]): number[] {
  const out: number[] = [];
  for (let frac = 0; frac <= 1; frac += 0.2) {
    out.push(omegas[Math.floor(frac * (omegas.length - 1))]);
  }
  return out;
}

function solveRootLocus(tf: TransferFunction): ControlDoc {
  const rl = buildRootLocus(tf);
  // Convert branch points to series, splitting any extreme jumps
  const series = rl.branches.map((branch, idx) => ({
    xs: branch.map((p) => p.re),
    ys: branch.map((p) => p.im),
    label: `branch ${idx + 1}`,
  }));
  const jwRows = rl.jwCrossings.map((c) => [fmtNum(c.omega), fmtNum(c.gain)]);

  return {
    title: 'Root Locus',
    summary: `G(s)H(s) = ${fmtTf(tf)}. ${rl.poles.length} branches, ${Math.max(0, rl.poles.length - rl.zeros.length)} asymptotes at ${rl.asymptotes.angles.map((a) => fmtNum((a * 180) / Math.PI)).join('°, ')}° (centroid σ_a = ${fmtNum(rl.asymptotes.centroid)}). ${rl.jwCrossings.length > 0 ? `Crosses jω-axis at ω=${fmtNum(rl.jwCrossings[0].omega)} for K=${fmtNum(rl.jwCrossings[0].gain)}.` : 'No jω crossing detected.'}`,
    sections: [
      { kind: 'equation', title: 'Open-loop TF', lines: [`G(s)H(s) = ${fmtTf(tf)}`] },
      {
        kind: 'text',
        title: 'Construction rules',
        lines: [
          '1. Branches start (K=0) at the open-loop poles, end (K→∞) at the open-loop zeros (finite + infinite).',
          '2. # asymptotes = n − m  (= ' + (rl.poles.length - rl.zeros.length) + ' here).',
          '3. Asymptote centroid σ_a = (Σ poles − Σ zeros)/(n − m) = ' + fmtNum(rl.asymptotes.centroid) + '.',
          '4. Asymptote angles φ = (2q+1)·180°/(n−m), q = 0,1,…',
          '5. Real-axis segments lie to the LEFT of an odd total count of real poles + zeros.',
          '6. Breakaway/break-in: solve dK/ds = 0.  Candidates here: ' + (rl.breakaways.length ? rl.breakaways.map(fmtNum).join(', ') : 'none on real axis'),
          '7. jω-crossing: solve the characteristic polynomial for purely imaginary roots and back-solve K.',
        ],
      },
      {
        kind: 'xy-plot',
        title: 'Root locus (s-plane)',
        series,
        xLabel: 'σ (Re)',
        yLabel: 'jω (Im)',
        hlines: [{ y: 0 }],
        vlines: [{ x: 0 }],
      },
      {
        kind: 'pole-zero',
        title: 'Open-loop poles (×) and zeros (○)',
        poles: rl.poles,
        zeros: rl.zeros,
      },
      ...(jwRows.length > 0
        ? [{
            kind: 'table' as const,
            title: 'jω-axis crossings',
            headers: ['ω (rad/s)', 'Critical K'],
            rows: jwRows,
          }]
        : []),
    ],
  };
}

function solveTimeResponse(tf: TransferFunction, kind: 'step' | 'impulse' | 'ramp', amp = 1): ControlDoc {
  const tr = computeTimeResponse(tf, { inputType: kind, amplitude: amp });
  const m = tr.metrics;
  const so = identifySecondOrder(tf);
  const fo = identifyFirstOrder(tf);
  const idLines: string[] = [];
  if (fo) {
    idLines.push(`1st-order: K = ${fmtNum(fo.K)}, τ = ${fmtNum(fo.tau)} s,  G(s) = ${fmtNum(fo.K)} / (${fmtNum(fo.tau)}s + 1).`);
    if (kind === 'step') idLines.push(`Step response: y(t) = K(1 − e^{−t/τ}).  Settling time ≈ 4τ = ${fmtNum(4 * fo.tau)} s.`);
  } else if (so) {
    idLines.push(`2nd-order: ωn = ${fmtNum(so.wn)} rad/s, ζ = ${fmtNum(so.zeta)}, K = ${fmtNum(so.K)}.`);
    if (so.zeta < 1) {
      const wd = so.wn * Math.sqrt(1 - so.zeta * so.zeta);
      idLines.push(`Underdamped: ωd = ωn√(1−ζ²) = ${fmtNum(wd)} rad/s.`);
      idLines.push(`Overshoot Mp = exp(−ζπ/√(1−ζ²)) × 100% = ${fmtNum(Math.exp((-so.zeta * Math.PI) / Math.sqrt(1 - so.zeta * so.zeta)) * 100)}%.`);
      idLines.push(`Peak time tp = π/ωd = ${fmtNum(Math.PI / wd)} s.`);
      idLines.push(`Settling (2%) ≈ 4/(ζωn) = ${fmtNum(4 / (so.zeta * so.wn))} s.`);
    } else if (Math.abs(so.zeta - 1) < 1e-6) {
      idLines.push('Critically damped — fastest non-oscillating response.');
    } else {
      idLines.push('Overdamped — slow non-oscillating response with two real poles.');
    }
  }
  const metricRows: string[][] = [];
  if (m.yFinal !== undefined) metricRows.push(['Final value', fmtNum(m.yFinal)]);
  if (m.yPeak !== undefined) metricRows.push(['Peak value', fmtNum(m.yPeak)]);
  if (m.tPeak !== undefined) metricRows.push(['Peak time tp (s)', fmtNum(m.tPeak)]);
  if (m.overshoot !== undefined) metricRows.push(['Overshoot Mp (%)', fmtNum(m.overshoot)]);
  if (m.riseTime !== undefined) metricRows.push(['Rise time tr (10–90 %)', fmtNum(m.riseTime)]);
  if (m.settlingTime2 !== undefined) metricRows.push(['Settling time ts (2 %)', fmtNum(m.settlingTime2)]);
  if (m.settlingTime5 !== undefined) metricRows.push(['Settling time ts (5 %)', fmtNum(m.settlingTime5)]);
  if (m.delayTime !== undefined) metricRows.push(['Delay time td (50 %)', fmtNum(m.delayTime)]);
  if (m.steadyStateError !== undefined) metricRows.push(['Steady-state error', fmtNum(m.steadyStateError)]);
  if (m.classification) metricRows.push(['Classification', m.classification]);

  return {
    title: `${kind.charAt(0).toUpperCase() + kind.slice(1)} Response`,
    summary: `G(s) = ${fmtTf(tf)}.  Amplitude = ${fmtNum(amp)}.  ${idLines.join('  ')}`,
    sections: [
      { kind: 'equation', title: 'Transfer function', lines: [`G(s) = ${fmtTf(tf)}`] },
      ...(idLines.length ? [{ kind: 'text' as const, title: 'System characterisation', lines: idLines }] : []),
      {
        kind: 'xy-plot',
        title: `${kind} response y(t)`,
        series: [{ xs: tr.ts, ys: tr.ys, label: 'y(t)' }],
        xLabel: 't (s)',
        yLabel: 'y(t)',
      },
      { kind: 'table', title: 'Performance metrics', headers: ['Metric', 'Value'], rows: metricRows },
    ],
  };
}

function solveStateSpaceFromTF(tf: TransferFunction): ControlDoc {
  const ss = tfToStateSpaceCCF(tf);
  return {
    title: 'TF → State-Space (Controllable Canonical Form)',
    summary: `Converted G(s) = ${fmtTf(tf)} to controllable canonical state-space.`,
    sections: [
      { kind: 'equation', title: 'Source TF', lines: [`G(s) = ${fmtTf(tf)}`] },
      {
        kind: 'text',
        title: 'Procedure',
        lines: [
          '1. Make the denominator monic (divide num and den by the leading denominator coefficient).',
          '2. If the system is proper (deg(num) = deg(den)), extract the direct term D = b_n / a_n.',
          '3. The remaining strictly-proper numerator gives the C-row (low→high coefficients).',
          '4. A is the companion matrix of the denominator (1s on the super-diagonal, −a_i on the last row).',
          '5. B is the unit basis vector e_n.',
        ],
      },
      { kind: 'matrix', title: 'State matrix A', name: 'A', data: ss.A },
      { kind: 'matrix', title: 'Input matrix B', name: 'B', data: ss.B },
      { kind: 'matrix', title: 'Output matrix C', name: 'C', data: ss.C },
      { kind: 'matrix', title: 'Direct term D', name: 'D', data: ss.D },
    ],
  };
}

function solveStateSpaceToTF(ss: import('./controlTypes').StateSpace): ControlDoc {
  const tf = stateSpaceToTf(ss);
  return {
    title: 'State-Space → Transfer Function',
    summary: `Resulting transfer function: G(s) = ${fmtTf(tf)}.`,
    sections: [
      { kind: 'matrix', title: 'A', name: 'A', data: ss.A },
      { kind: 'matrix', title: 'B', name: 'B', data: ss.B },
      { kind: 'matrix', title: 'C', name: 'C', data: ss.C },
      { kind: 'matrix', title: 'D', name: 'D', data: ss.D },
      {
        kind: 'text',
        title: 'Formula',
        lines: [
          'G(s) = C (sI − A)^{-1} B + D',
          'Numerator polynomial built via Faddeev–LeVerrier recursion:',
          '  M_0 = I,  c_k = −trace(A·M_{k−1})/k,  M_k = A·M_{k−1} + c_k·I',
          '  num coefficient at s^{n−1−k} = C · M_k · B.',
        ],
      },
      { kind: 'equation', title: 'Result', lines: [`G(s) = ${fmtTf(tf)}`] },
    ],
  };
}

function solveControllability(ss: import('./controlTypes').StateSpace): ControlDoc {
  const Qc = controllabilityMatrix(ss.A, ss.B);
  const { rank, controllable } = isControllable(ss.A, ss.B);
  return {
    title: 'Controllability Analysis',
    summary: `Q_c = [B  AB  A²B …].  rank(Q_c) = ${rank}, n = ${ss.A.length}.  System is ${controllable ? 'CONTROLLABLE' : 'NOT CONTROLLABLE'}.`,
    sections: [
      { kind: 'matrix', title: 'A', name: 'A', data: ss.A },
      { kind: 'matrix', title: 'B', name: 'B', data: ss.B },
      { kind: 'matrix', title: 'Controllability matrix Q_c', name: 'Q_c', data: Qc },
      {
        kind: 'text',
        title: 'Result',
        lines: [
          `rank(Q_c) = ${rank},  n = ${ss.A.length}`,
          controllable
            ? '⇒ Q_c is full rank, so every state can be reached by some input. System is controllable.'
            : '⇒ Q_c is rank-deficient; some state combinations are unreachable. System is NOT controllable.',
        ],
      },
    ],
  };
}

function solveObservability(ss: import('./controlTypes').StateSpace): ControlDoc {
  const O = observabilityMatrix(ss.A, ss.C);
  const { rank, observable } = isObservable(ss.A, ss.C);
  return {
    title: 'Observability Analysis',
    summary: `Q_o = [C; CA; CA²; …].  rank(Q_o) = ${rank}, n = ${ss.A.length}.  System is ${observable ? 'OBSERVABLE' : 'NOT OBSERVABLE'}.`,
    sections: [
      { kind: 'matrix', title: 'A', name: 'A', data: ss.A },
      { kind: 'matrix', title: 'C', name: 'C', data: ss.C },
      { kind: 'matrix', title: 'Observability matrix Q_o', name: 'Q_o', data: O },
      {
        kind: 'text',
        title: 'Result',
        lines: [
          `rank(Q_o) = ${rank},  n = ${ss.A.length}`,
          observable
            ? '⇒ Q_o is full rank, so the internal state can be inferred from output measurements over time. System is observable.'
            : '⇒ Q_o is rank-deficient; some state-space directions are unobservable from the output.',
        ],
      },
    ],
  };
}

function solveStateTransition(ss: import('./controlTypes').StateSpace, t: number): ControlDoc {
  const Phi = stateTransitionMatrix(ss.A, t);
  return {
    title: 'State Transition Matrix',
    summary: `Φ(t) = exp(A·t), evaluated at t = ${fmtNum(t)}.`,
    sections: [
      { kind: 'matrix', title: 'A', name: 'A', data: ss.A },
      {
        kind: 'text',
        title: 'Definition',
        lines: [
          'Φ(t) = exp(A·t) = I + A·t + (A·t)²/2! + (A·t)³/3! + …',
          'For autonomous systems x(t) = Φ(t)·x(0).',
          'For inputs use x(t) = Φ(t)·x(0) + ∫₀^t Φ(t−τ)·B·u(τ) dτ.',
        ],
      },
      { kind: 'matrix', title: `Φ(${fmtNum(t)})`, name: `Φ(${fmtNum(t)})`, data: Phi },
    ],
  };
}

function solveBlockReduction(spec: ReturnType<typeof import('./blockDiagram').parseBlockDiagramSpec>): ControlDoc {
  const r = reduceBlockDiagram(spec);
  return {
    title: 'Block Diagram Reduction',
    summary: `Final closed-loop transfer function: ${fmtTf(r.final)}`,
    sections: [
      {
        kind: 'text',
        title: 'Defined blocks',
        lines: Object.entries(spec.blocks).map(([name, tf]) => `${name}(s) = ${fmtTf(tf)}`),
      },
      ...r.steps.flatMap((step): ControlSection[] => [
        { kind: 'text' as const, title: 'Step', lines: [step.description] },
        { kind: 'block-diagram' as const, diagram: step.diagram },
      ]),
      { kind: 'equation', title: 'Final TF', lines: [`G_total(s) = ${fmtTf(r.final)}`] },
    ],
  };
}

function solveSFGMason(spec: import('./signalFlowGraph').SFGSpec, env: Record<string, number>): ControlDoc {
  const m = masonsGain(spec, env);
  const graph = specToGraph(spec);
  const fwdRows = m.forwardPaths.map((p, i) => [
    `P${i + 1}`,
    p.nodes.join(' → '),
    p.gain,
    fmtNum(p.gainValue),
    `Δ${i + 1} = ${m.deltaK[i]}`,
    fmtNum(m.deltaKValues[i]),
  ]);
  const loopRows = m.loops.map((l, i) => [
    `L${i + 1}`,
    l.nodes.join(' → '),
    l.gain,
    fmtNum(l.gainValue),
  ]);
  return {
    title: "Signal-Flow Graph (Mason's Gain Formula)",
    summary: `T = Σ Pₖ Δₖ / Δ = ${fmtNum(m.transferFunctionValue)}.`,
    sections: [
      { kind: 'sfg', title: 'Signal-flow graph', graph },
      {
        kind: 'table',
        title: 'Forward paths',
        headers: ['#', 'Path', 'Gain', 'Pₖ', 'Δₖ', 'Δₖ value'],
        rows: fwdRows,
      },
      {
        kind: 'table',
        title: 'Loops',
        headers: ['#', 'Cycle', 'Gain', 'Lᵢ'],
        rows: loopRows,
      },
      {
        kind: 'equation',
        title: 'Determinant',
        lines: [`Δ = ${m.delta}`, `Δ = ${fmtNum(m.deltaValue)}`],
      },
      {
        kind: 'equation',
        title: "Mason's Gain",
        lines: [`T = (Σ Pₖ Δₖ) / Δ = ${fmtNum(m.transferFunctionValue)}`],
      },
    ],
  };
}

function solveCompensator(topic: ControlTopic, params: Record<string, number>): ControlDoc {
  const Kp = params.Kp ?? params.kp ?? 1;
  const Ki = params.Ki ?? params.ki ?? 0;
  const Kd = params.Kd ?? params.kd ?? 0;
  let tf;
  let title;
  let summary;
  switch (topic) {
    case 'pid': {
      const N = params.N ?? 0;
      tf = PID(Kp, Ki, Kd, N);
      title = 'PID Controller';
      summary = `Gc(s) = Kp + Ki/s + Kd·s = ${tf.display}.`;
      if (params.Ku && params.Tu) {
        const zn = zieglerNicholsPID(params.Ku, params.Tu);
        return {
          title,
          summary: summary + `  Ziegler–Nichols tuning: Kp=${fmtNum(zn.params.Kp)}, Ki=${fmtNum(zn.params.Ki)}, Kd=${fmtNum(zn.params.Kd)}.`,
          sections: [
            { kind: 'equation', title: 'PID transfer function', lines: [`Gc(s) = ${fmtTf(zn)}`] },
            {
              kind: 'text',
              title: 'Ziegler–Nichols (ultimate-gain) tuning',
              lines: [
                `Ultimate gain Ku = ${fmtNum(params.Ku)},  Ultimate period Tu = ${fmtNum(params.Tu)} s.`,
                `Kp = 0.6·Ku = ${fmtNum(zn.params.Kp)}`,
                `Ki = 2·Kp/Tu = ${fmtNum(zn.params.Ki)}`,
                `Kd = Kp·Tu/8 = ${fmtNum(zn.params.Kd)}`,
              ],
            },
          ],
        };
      }
      break;
    }
    case 'pi':
      tf = PI(Kp, Ki);
      title = 'PI Controller';
      summary = `Gc(s) = Kp + Ki/s = ${tf.display}.  Adds a pole at origin (type number raised by 1) and a zero at s = −Ki/Kp.`;
      break;
    case 'pd':
      tf = PD(Kp, Kd);
      title = 'PD Controller';
      summary = `Gc(s) = Kp + Kd·s = ${tf.display}.  Adds a zero at s = −Kp/Kd; improves transient response, ideal PD is non-causal in practice.`;
      break;
    case 'lead': {
      const phi = params.phi ?? params.phim ?? 45;
      const wm = params.wm ?? params.omega ?? 10;
      const Kc = params.Kc;
      const d = designLead({ phiMaxDeg: phi, omegaM: wm, Kc });
      tf = d.tf;
      title = 'Lead Compensator';
      summary = `Designed for max phase lead φm = ${fmtNum(phi)}° at ωm = ${fmtNum(wm)} rad/s.  α = ${fmtNum(d.params.alpha)}, zero at ${fmtNum(-d.params.z)}, pole at ${fmtNum(-d.params.p)}.`;
      break;
    }
    case 'lag': {
      const beta = params.beta ?? 10;
      const wp = params.wm ?? params.omega ?? params.wp ?? 1;
      const Kc = params.Kc;
      const d = designLag({ beta, omegaPlace: wp, Kc });
      tf = d.tf;
      title = 'Lag Compensator';
      summary = `β = ${fmtNum(beta)} placed at ωₚ = ${fmtNum(wp)} rad/s.  Zero at ${fmtNum(-d.params.z)}, pole at ${fmtNum(-d.params.p)}.`;
      break;
    }
    case 'lead-lag': {
      const phi = params.phi ?? 45;
      const wm = params.wm ?? 10;
      const beta = params.beta ?? 10;
      const wp = params.wp ?? 1;
      const d = designLeadLag(
        { phiMaxDeg: phi, omegaM: wm },
        { beta, omegaPlace: wp }
      );
      tf = d.tf;
      title = 'Lead-Lag Compensator';
      summary = `Lead: φm=${fmtNum(phi)}°, ωm=${fmtNum(wm)}.  Lag: β=${fmtNum(beta)}, ωₚ=${fmtNum(wp)}.`;
      break;
    }
    default:
      tf = P(Kp);
      title = 'Proportional Controller';
      summary = `Gc(s) = ${fmtNum(Kp)}.`;
  }
  return {
    title,
    summary,
    sections: [
      { kind: 'equation', title: 'Transfer function', lines: [`Gc(s) = ${fmtTf(tf)}`] },
      { kind: 'pole-zero', title: 'Compensator pole-zero map', poles: getPoles(tf), zeros: getZeros(tf) },
      {
        kind: 'xy-plot',
        title: 'Compensator Bode plot',
        series: (() => {
          const b = computeBode(tf);
          return [
            { xs: b.omegas, ys: b.magsDb, label: '|Gc| (dB)' },
          ];
        })(),
        xLabel: 'ω (rad/s)',
        yLabel: 'Magnitude (dB)',
        xLog: true,
        gridDecades: true,
      },
    ],
  };
}

function solveModeling(topic: ControlTopic, params: Record<string, number>): ControlDoc {
  if (topic === 'mech-modeling') {
    const m = params.m ?? params.M ?? 1;
    const b = params.b ?? params.B ?? 1;
    const k = params.k ?? params.K ?? 1;
    if (params.J !== undefined) {
      const tf = rotationalPosition(params.J, params.B ?? 0, params.K ?? 0);
      return basicModelDoc('Rotational Mechanical System', tf, [
        `Jθ̈ + Bθ̇ + Kθ = T(t)`,
        `θ(s)/T(s) = ${tf.display}`,
      ]);
    }
    const tf = massSpringDamper(m, b, k);
    return basicModelDoc('Mass-Spring-Damper', tf, [
      'Newton: m·ẍ + b·ẋ + k·x = F(t)',
      `Take Laplace (zero ICs):  (m s² + b s + k)·X(s) = F(s)`,
      `X(s)/F(s) = ${tf.display}`,
      `ωn = √(k/m) = ${fmtNum(Math.sqrt(k / m))} rad/s,  ζ = b/(2·√(km)) = ${fmtNum(b / (2 * Math.sqrt(k * m)))}`,
    ]);
  }
  if (topic === 'elec-modeling') {
    const R = params.R ?? 1, L = params.L ?? 0.1, C = params.C ?? 0.01;
    const tf = rlcSeriesAcrossC(R, L, C);
    return basicModelDoc('RLC Series Circuit (output across capacitor)', tf, [
      `KVL: V_in = L·dI/dt + R·I + V_C,  with I = C·dV_C/dt`,
      `V_C(s)/V_in(s) = 1 / (LCs² + RCs + 1)`,
      `= ${tf.display}`,
    ]);
  }
  if (topic === 'dc-motor') {
    const R = params.Ra ?? params.R ?? 1, L = params.La ?? params.L ?? 0.5;
    const Kt = params.Kt ?? 0.1, Kb = params.Kb ?? 0.1;
    const J = params.J ?? 0.01, B = params.B ?? 0.1;
    const tfPos = dcMotorPosition({ R_a: R, L_a: L, K_t: Kt, K_b: Kb, J, B });
    const tfVel = dcMotorVelocity({ R_a: R, L_a: L, K_t: Kt, K_b: Kb, J, B });
    return {
      title: 'Armature-Controlled DC Motor',
      summary: `Position: ${tfPos.display}.  Velocity: ${tfVel.display}.`,
      sections: [
        {
          kind: 'text',
          title: 'Equations',
          lines: [
            'Electrical (armature loop): V_a = R_a·i_a + L_a·di_a/dt + K_b·ω',
            'Mechanical (rotor):        J·dω/dt + B·ω = K_t·i_a',
            'Position is the integral of ω: θ = ∫ω dt.',
          ],
        },
        { kind: 'equation', title: 'Velocity transfer function', lines: [`ω(s)/V_a(s) = ${fmtTf(tfVel)}`] },
        { kind: 'equation', title: 'Position transfer function', lines: [`θ(s)/V_a(s) = ${fmtTf(tfPos)}`] },
        { kind: 'pole-zero', title: 'Position TF pole-zero map', poles: getPoles(tfPos), zeros: getZeros(tfPos) },
      ],
    };
  }
  if (topic === 'servo') {
    const R = params.Ra ?? 1, L = params.La ?? 0.5, Kt = params.Kt ?? 0.1, Kb = params.Kb ?? 0.1;
    const J = params.J ?? 0.01, B = params.B ?? 0.1, Ka = params.Ka ?? 1;
    const motor = dcMotorPosition({ R_a: R, L_a: L, K_t: Kt, K_b: Kb, J, B });
    const open = positionServoOpenLoop(motor, Ka);
    const closed = fbReduce(open);
    return {
      title: 'Position Servo System',
      summary: `Closed-loop TF: ${fmtTf(closed)}.`,
      sections: [
        { kind: 'equation', title: 'Open-loop', lines: [`G(s) = ${fmtTf(open)}`] },
        { kind: 'equation', title: 'Closed-loop (unity feedback)', lines: [`T(s) = ${fmtTf(closed)}`] },
        { kind: 'pole-zero', title: 'Closed-loop poles & zeros', poles: getPoles(closed), zeros: getZeros(closed) },
      ],
    };
  }
  if (topic === 'analogous') {
    return {
      title: 'Analogous Systems',
      summary: 'Mapping between electrical and mechanical (translational) variables.',
      sections: [
        {
          kind: 'table',
          title: 'Force–Voltage / Force–Current analogy',
          headers: ['Electrical', 'Force–Voltage analog', 'Force–Current analog'],
          rows: ANALOGOUS_TABLE.map((row) => [row.electrical, row.forceVoltage, row.forceCurrent]),
        },
        {
          kind: 'text',
          title: 'Usage',
          lines: [
            '• Force–Voltage: equate mesh equations (KVL) of an electrical circuit with Newton’s 2nd law equations of a mechanical system.',
            '• Force–Current: equate node equations (KCL) with Newton’s law (the dual analogy).',
            '• Same TF results in either domain because both are LTI systems with identical structure.',
          ],
        },
      ],
    };
  }
  throw new Error('Unsupported modeling topic');
}

function basicModelDoc(title: string, tf: TransferFunction, lines: string[]): ControlDoc {
  return {
    title,
    summary: `Derived TF: ${tf.display}.`,
    sections: [
      { kind: 'text', title: 'Derivation', lines },
      { kind: 'equation', title: 'Transfer function', lines: [`G(s) = ${fmtTf(tf)}`] },
      { kind: 'pole-zero', title: 'Pole-zero map', poles: getPoles(tf), zeros: getZeros(tf) },
    ],
  };
}

function solveFeedback(tf: TransferFunction, params: Record<string, number>): ControlDoc {
  const K = params.K ?? 1;
  const open = { numerator: tf.numerator.map((v) => v * K), denominator: tf.denominator.slice(), display: `${fmtNum(K)}·${tf.display}` };
  const closed = fbReduce(open);
  return {
    title: 'Feedback System',
    summary: `Closed-loop TF (negative unity feedback, K=${fmtNum(K)}): ${fmtTf(closed)}.`,
    sections: [
      { kind: 'equation', title: 'Forward path', lines: [`G(s) = ${fmtTf(open)}`] },
      { kind: 'equation', title: 'Closed-loop', lines: [`T(s) = G/(1+G) = ${fmtTf(closed)}`] },
      { kind: 'pole-zero', title: 'Closed-loop poles', poles: getPoles(closed), zeros: getZeros(closed) },
      {
        kind: 'block-diagram',
        title: 'Standard unity-feedback configuration',
        diagram: {
          blocks: [
            { id: 'R', kind: 'input', label: 'R(s)' },
            { id: 'SUM', kind: 'sum', signs: ['+', '-'] },
            { id: 'G', kind: 'tf', expr: 'G(s)' },
            { id: 'C', kind: 'output', label: 'C(s)' },
          ],
          edges: [
            { from: 'R', to: 'SUM', toPort: 0 },
            { from: 'SUM', to: 'G' },
            { from: 'G', to: 'C' },
            { from: 'G', to: 'SUM', toPort: 1 },
          ],
        },
      },
    ],
  };
}

function solveStabilityMargins(tf: TransferFunction): ControlDoc {
  const b = computeBode(tf);
  const verdict = (b.phaseMarginDeg ?? -Infinity) > 0 && (b.gainMarginDb ?? -Infinity) > 0
    ? 'STABLE'
    : 'UNSTABLE / marginal';
  return {
    title: 'Stability Margins',
    summary: `Gain margin = ${b.gainMarginDb !== null ? fmtNum(b.gainMarginDb) + ' dB' : '∞'}, Phase margin = ${b.phaseMarginDeg !== null ? fmtNum(b.phaseMarginDeg) + '°' : '—'}.  Verdict: ${verdict}.`,
    sections: [
      { kind: 'equation', title: 'Open-loop', lines: [`G(s) = ${fmtTf(tf)}`] },
      {
        kind: 'xy-plot',
        title: 'Magnitude (dB)',
        series: [{ xs: b.omegas, ys: b.magsDb, label: 'dB' }],
        xLabel: 'ω (rad/s)',
        yLabel: 'dB',
        xLog: true,
        gridDecades: true,
        hlines: [{ y: 0, label: '0 dB', style: 'dashed' }],
        vlines: b.wcg ? [{ x: b.wcg, label: 'ωcg' }] : [],
      },
      {
        kind: 'xy-plot',
        title: 'Phase (deg)',
        series: [{ xs: b.omegas, ys: b.phasesDeg, label: '°' }],
        xLabel: 'ω (rad/s)',
        yLabel: '°',
        xLog: true,
        gridDecades: true,
        hlines: [{ y: -180, label: '-180°', style: 'dashed' }],
        vlines: b.wcp ? [{ x: b.wcp, label: 'ωcp' }] : [],
      },
    ],
  };
}

/* ============================================================ */
/* Public entry                                                  */
/* ============================================================ */

export function solveControlQuestion(text: string): SolverResult {
  const q = parseControlQuestion(text);
  try {
    const doc = route(q);
    if (!doc) return refusalForTopic(q);
    const meta = controlMetaFromDoc(doc, q.topic, q.tf);
    return { ...packageDoc(doc), meta };
  } catch (e) {
    return refusal(`Could not solve: ${(e as Error).message}`, defaultManualInstructions(q.topic));
  }
}

function route(q: ParsedQuestion): ControlDoc | null {
  const t = q.topic;
  if (t === 'unknown') return null;
  switch (t) {
    case 'pole-zero':
      if (!q.tf) return null;
      return solvePoleZero(q.tf);

    case 'routh':
      if (q.tf) return solveRouth(q.tf.denominator, polyToString(q.tf.denominator));
      if (q.poly) return solveRouth(q.poly, polyToString(q.poly));
      return null;

    case 'bode':
    case 'frequency-response':
      if (!q.tf) return null;
      return solveBode(q.tf);

    case 'nyquist':
      if (!q.tf) return null;
      return solveNyquist(q.tf);

    case 'polar':
      if (!q.tf) return null;
      return solvePolar(q.tf);

    case 'root-locus':
      if (!q.tf) return null;
      return solveRootLocus(q.tf);

    case 'step-response':
      if (!q.tf) return null;
      return solveTimeResponse(q.tf, 'step', q.params?.A ?? q.params?.amplitude ?? 1);

    case 'impulse-response':
      if (!q.tf) return null;
      return solveTimeResponse(q.tf, 'impulse', q.params?.A ?? q.params?.amplitude ?? 1);

    case 'ramp-response':
    case 'time-response':
      if (!q.tf) return null;
      return solveTimeResponse(q.tf, 'ramp', q.params?.A ?? q.params?.amplitude ?? 1);

    case 'first-order':
    case 'second-order':
      if (!q.tf) return null;
      return solveTimeResponse(q.tf, 'step', 1);

    case 'tf-to-ss':
      if (!q.tf) return null;
      return solveStateSpaceFromTF(q.tf);

    case 'state-space':
      if (q.ss) return solveStateSpaceToTF(q.ss);
      if (q.tf) return solveStateSpaceFromTF(q.tf);
      return null;

    case 'ss-to-tf':
      if (!q.ss) return null;
      return solveStateSpaceToTF(q.ss);

    case 'controllability':
      if (!q.ss) {
        if (q.tf) {
          const ss = tfToStateSpaceCCF(q.tf);
          return solveControllability(ss);
        }
        return null;
      }
      return solveControllability(q.ss);

    case 'observability':
      if (!q.ss) {
        if (q.tf) {
          const ss = tfToStateSpaceCCF(q.tf);
          return solveObservability(ss);
        }
        return null;
      }
      return solveObservability(q.ss);

    case 'state-transition':
      if (!q.ss) {
        if (q.tf) return solveStateTransition(tfToStateSpaceCCF(q.tf), q.params?.t ?? 1);
        return null;
      }
      return solveStateTransition(q.ss, q.params?.t ?? 1);

    case 'block-reduction':
      if (!q.block) return null;
      return solveBlockReduction(q.block);

    case 'sfg-mason':
      if (!q.sfg) return null;
      return solveSFGMason(q.sfg, q.params ?? {});

    case 'feedback':
      if (!q.tf) return null;
      return solveFeedback(q.tf, q.params ?? {});

    case 'pid':
    case 'pi':
    case 'pd':
    case 'lead':
    case 'lag':
    case 'lead-lag':
      return solveCompensator(t, q.params ?? {});

    case 'mech-modeling':
    case 'elec-modeling':
    case 'analogous':
    case 'dc-motor':
    case 'servo':
      return solveModeling(t, q.params ?? {});

    case 'gain-phase-margin':
      if (!q.tf) return null;
      return solveStabilityMargins(q.tf);

    case 'stability':
      if (q.tf) return solveRouth(q.tf.denominator, polyToString(q.tf.denominator));
      if (q.poly) return solveRouth(q.poly, polyToString(q.poly));
      return null;
  }
  return null;
}

function refusalForTopic(q: ParsedQuestion): SolverResult {
  const t = q.topic;
  if (t === 'unknown') {
    return refusal(
      'I could not infer which Control Systems analysis you want. Supported: pole-zero, Routh-Hurwitz, Bode, Nyquist, polar, root locus, step/impulse/ramp response, state-space conversion, controllability, observability, state transition matrix, block-diagram reduction, signal-flow graph (Mason\'s gain), feedback, PID/PI/PD, lead/lag/lead-lag, mass-spring-damper, RLC, DC motor, servo, analogous systems.',
      [
        'Identify the question type explicitly (e.g., "Bode plot of ...", "step response of ...", "Routh on ...").',
        'Express the system as G(s) = N(s)/D(s) with parentheses around grouped factors.',
        'For state-space, provide A=[[...],[...]]; B=[[...]]; C=[[...]]; D=[[0]].',
        'For block-diagram problems give per-block TFs and operations (series / parallel / feedback ... over H).',
        'For SFG problems list branches: "X1 -> X2 : a", "X2 -> X3 : b", "input: X1", "output: X3".',
      ]
    );
  }
  return refusal(
    `Topic "${t}" detected, but a required input was missing. Provide a transfer function or matching specification.`,
    defaultManualInstructions(t)
  );
}

function defaultManualInstructions(t: ControlTopic): string[] {
  switch (t) {
    case 'block-reduction':
      return [
        'List the blocks (e.g., "G1 = 1/(s+1)", "G2 = 10/(s^2+2s+5)").',
        'Then state operations: "series: G1, G2" or "negative feedback G1*G2 over H".',
      ];
    case 'sfg-mason':
      return [
        'List branches: "X1 -> X2 : a", "X2 -> X3 : b", "X3 -> X2 : -c".',
        'Add lines: "input: X1" and "output: Xn" to mark the source and sink.',
        'Provide numeric values for symbolic gains via "a = 2, b = 0.5".',
      ];
    case 'state-space':
    case 'controllability':
    case 'observability':
    case 'state-transition':
      return [
        'Give explicit matrices like A=[[0,1],[-2,-3]]; B=[[0],[1]]; C=[[1,0]]; D=[[0]].',
        'For state-transition include a time, e.g., "t = 0.5".',
      ];
    default:
      return [
        'Express the system explicitly as G(s) = N(s)/D(s).',
        'Use ^ for powers (s^2) and parentheses for grouped factors.',
      ];
  }
}

export { polyToString };
