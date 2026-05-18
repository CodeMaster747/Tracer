/**
 * Core types for the deep Control Systems engine.
 * Covers transfer functions, state-space, block diagrams, signal-flow graphs,
 * root locus / Bode / Nyquist / polar plots, time-response, compensator design,
 * and renderable multi-section solution documents.
 */
import type { Polynomial, Complex } from './polynomial';
import type { TransferFunction } from './transferFunction';

/* ---------- Plot data ---------- */

export interface XYSeries {
  xs: number[];
  ys: number[];
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

/* ---------- Block diagram ---------- */

export interface DiagramBlock {
  id: string;
  /** 'tf' = transfer-function box; 'sum' = summing junction; 'pickoff' = takeoff point; 'gain' = constant gain */
  kind: 'tf' | 'sum' | 'pickoff' | 'gain' | 'input' | 'output';
  label?: string;
  /** For tf/gain: the expression rendered inside the block */
  expr?: string;
  /** Optional explicit (x,y) in mm. If absent, layout will place automatically. */
  x?: number;
  y?: number;
  /** Per-input sign for summing junctions, indexed by incoming edge order */
  signs?: ('+' | '-')[];
}

export interface DiagramEdge {
  from: string;
  to: string;
  /** When the target is a summing junction, which input index (0,1,…) this edge feeds */
  toPort?: number;
  label?: string;
}

export interface BlockDiagram {
  blocks: DiagramBlock[];
  edges: DiagramEdge[];
  title?: string;
}

/* ---------- Signal flow graph ---------- */

export interface SFGNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
}

export interface SFGBranch {
  from: string;
  to: string;
  gain: string;
}

export interface SignalFlowGraph {
  nodes: SFGNode[];
  branches: SFGBranch[];
  inputNode?: string;
  outputNode?: string;
}

/* ---------- State space ---------- */

export interface StateSpace {
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
}

/* ---------- Document sections ---------- */

export type ControlSection =
  | { kind: 'text'; title?: string; lines: string[]; mono?: boolean }
  | { kind: 'equation'; title?: string; lines: string[] }
  | { kind: 'matrix'; title?: string; name: string; data: number[][] }
  | {
      kind: 'table';
      title?: string;
      headers: string[];
      rows: string[][];
      highlightFirstCol?: boolean;
    }
  | {
      kind: 'pole-zero';
      title?: string;
      poles: Complex[];
      zeros: Complex[];
      annotateZeta?: boolean;
    }
  | {
      kind: 'xy-plot';
      title?: string;
      series: XYSeries[];
      xLabel: string;
      yLabel: string;
      xLog?: boolean;
      yLog?: boolean;
      gridDecades?: boolean;
      vlines?: { x: number; label?: string; style?: 'dashed' | 'dotted' }[];
      hlines?: { y: number; label?: string; style?: 'dashed' | 'dotted' }[];
    }
  | {
      kind: 'polar';
      title?: string;
      points: { re: number; im: number; omega?: number }[];
      annotateOmegas?: number[];
      includeUnitCircle?: boolean;
      includeMinusOne?: boolean;
    }
  | { kind: 'block-diagram'; title?: string; diagram: BlockDiagram }
  | { kind: 'sfg'; title?: string; graph: SignalFlowGraph };

export interface ControlDoc {
  title: string;
  summary: string;
  sections: ControlSection[];
}

/* ---------- Standard descriptions ---------- */

export interface SecondOrderSpec {
  wn: number;
  zeta: number;
  /** Optional DC gain numerator multiplier (if user gave K·wn² / …) */
  k?: number;
}

export interface FirstOrderSpec {
  /** Time constant τ */
  tau: number;
  /** DC gain */
  K: number;
}

export interface TimeResponseSpec {
  inputType: 'step' | 'impulse' | 'ramp';
  amplitude: number;
}

export interface TimeResponseResult {
  ts: number[];
  ys: number[];
  /** Metrics relevant to the system order */
  metrics: Record<string, number | string>;
}

export interface RootLocusResult {
  /** Array of branches, each is a list of complex points (one per gain step) */
  branches: Complex[][];
  /** k values sampled */
  gains: number[];
  poles: Complex[];
  zeros: Complex[];
  asymptotes: { centroid: number; angles: number[] };
  breakaways: number[];
  jwCrossings: { omega: number; gain: number }[];
}

export interface NyquistResult {
  /** Frequencies sampled (positive); the negative branch is implicit (conjugate) */
  omegas: number[];
  /** G(jω) at each ω */
  values: Complex[];
  gainMarginDb: number | null;
  phaseMarginDeg: number | null;
  /** Encirclements of -1 (positive = CW) — counted by tracing the full contour */
  encirclements: number;
  rhpOpenLoopPoles: number;
  closedLoopRhpPoles: number;
  stable: boolean;
}

export interface BodeResult {
  omegas: number[];
  magsDb: number[];
  phasesDeg: number[];
  gainMarginDb: number | null;
  phaseMarginDeg: number | null;
  wcg: number | null;
  wcp: number | null;
}

export interface MasonResult {
  forwardPaths: { nodes: string[]; gain: string; gainValue: number }[];
  loops: { nodes: string[]; gain: string; gainValue: number }[];
  nonTouching: string[][]; // pretty-printed combos
  delta: string;
  deltaValue: number;
  deltaK: string[];
  deltaKValues: number[];
  transferFunction: string;
  transferFunctionValue: number;
}

export interface BlockReductionStep {
  description: string;
  diagram: BlockDiagram;
}

export interface BlockReductionResult {
  steps: BlockReductionStep[];
  final: TransferFunction;
}

/* ---------- Re-exports ---------- */

export type { Polynomial, Complex, TransferFunction };
