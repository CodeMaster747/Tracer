/**
 * Core domain types shared across the canvas, chat, and engines.
 * Coordinate system: paper-millimeters with origin at TOP-LEFT of paper.
 * X grows right, Y grows down. Engines emit mm; canvas converts to px.
 */

export type Domain = 'graphics' | 'automata' | 'control';

export type PaperSize = 'A4' | 'A3' | 'A2';
export type PaperOrientation = 'portrait' | 'landscape';

export interface PaperSpec {
  size: PaperSize;
  orientation: PaperOrientation;
  widthMm: number;
  heightMm: number;
}

export const PAPER_DIMENSIONS: Record<PaperSize, { short: number; long: number }> = {
  A4: { short: 210, long: 297 },
  A3: { short: 297, long: 420 },
  A2: { short: 420, long: 594 },
};

export function paperSpec(size: PaperSize, orientation: PaperOrientation): PaperSpec {
  const { short, long } = PAPER_DIMENSIONS[size];
  const w = orientation === 'landscape' ? long : short;
  const h = orientation === 'landscape' ? short : long;
  return { size, orientation, widthMm: w, heightMm: h };
}

export interface Pt {
  x: number;
  y: number;
}

export type StrokeGeometry =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      double?: boolean;
    }
  | {
      kind: 'arc';
      cx: number;
      cy: number;
      r: number;
      startAngle: number;
      endAngle: number;
      anticlockwise?: boolean;
    }
  | { kind: 'curve'; points: Pt[]; closed?: boolean }
  | { kind: 'polygon'; points: Pt[] }
  | {
      kind: 'arrow';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      headSize?: number;
    }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      fontSize?: number;
      align?: 'start' | 'middle' | 'end';
      baseline?: 'auto' | 'middle' | 'hanging';
    };

export type DrawingTool =
  | 'HB Pencil'
  | '2H Pencil'
  | 'Compass'
  | 'Set Square'
  | 'T-Square'
  | 'Protractor'
  | 'Eraser'
  | 'Ruler';

export interface Stroke {
  id: string;
  order: number;
  tool: DrawingTool;
  instruction: string;
  geometry: StrokeGeometry;
  /** Logical start point (for stroke analysis display) */
  startMm: Pt;
  /** Logical end point (for stroke analysis display) */
  endMm: Pt;
  /** Radius for circles/arcs */
  radiusMm?: number;
  /** Optional category — affects color when not currently animated */
  layer?: 'construction' | 'final' | 'label' | 'dimension';
  /** Optional final fill — used for double-circle accepting states */
  doubled?: boolean;
  /**
   * Marker keeps a stroke colored after it has been drawn.
   * 'start' = blue (entry state, start arrows etc.)
   * 'accepting' = green (final state outer ring)
   */
  marker?: 'start' | 'accepting';
}

export interface SolvedQuestion {
  id: string;
  userId?: string;
  domain: Domain;
  title: string;
  question: string;
  summary: string;
  paper: PaperSpec;
  strokes: Stroke[];
  /** Subject-specific structured data the workspace module renders into its panels. */
  meta?: WorkspaceMeta;
  refusalReason?: string;
  createdAt: number;
  savedAt?: number;
  isExample?: boolean;
}

export interface SolverResult {
  success: boolean;
  summary: string;
  paper: PaperSpec;
  strokes: Stroke[];
  /** Subject-specific structured data — see WorkspaceMeta. */
  meta?: WorkspaceMeta;
  /** When success=false, why the engine could not solve */
  refusalReason?: string;
  /** When success=false, manual drawing instructions for the user */
  manualInstructions?: string[];
}

/* ------------------------------------------------------------------ */
/* Workspace meta — JSON-safe structured data per subject.             */
/* The base canvas never touches it; each module reads its own variant.*/
/* ------------------------------------------------------------------ */

export type WorkspaceMeta = AutomataMeta | ControlMeta;

/**
 * A JSON-safe content block that came from the engine's solution document.
 * Used by every subject sidebar so prose, equations, matrices, derivations,
 * and ancillary tables don't get drawn on the paper anymore — they live in
 * the panels where they belong.
 */
export type WorkspaceContentBlock =
  | { kind: 'text'; title?: string; lines: string[]; mono?: boolean }
  | { kind: 'list'; title?: string; ordered?: boolean; items: string[] }
  | { kind: 'equation'; title?: string; lines: string[] }
  | { kind: 'matrix'; title?: string; name: string; data: number[][] }
  | { kind: 'table'; title?: string; headers: string[]; rows: string[][] };

export type AutomataMachineType =
  | 'DFA'
  | 'NFA'
  | 'ε-NFA'
  | 'PDA'
  | 'TM'
  | 'Mealy'
  | 'Moore'
  | 'derived';

export interface AutomataTransition {
  from: string;
  /** For PDAs the symbol may be a composite "a, X / γ" label produced by the engine. */
  symbol: string;
  to: string;
}

export interface AutomataSimStep {
  index: number;
  consumed: string;
  remaining: string;
  /** For DFAs / Mealy / Moore: single active state. */
  state?: string;
  /** For NFA / ε-NFA: multiple simultaneously active states. */
  states?: string[];
  /** Symbol just read (empty string for ε). */
  symbol?: string;
}

export interface AutomataMeta {
  kind: 'automata';
  type: AutomataMachineType;
  alphabet: string[];
  states: string[];
  start: string;
  accepting: string[];
  transitions: AutomataTransition[];
  /** Pre-rendered transition table (engine output). Optional. */
  table?: { headers: string[]; rows: string[][] };
  /** Simulation trace if the question requested one. */
  simulation?: {
    input: string;
    accepted: boolean;
    reason?: string;
    steps: AutomataSimStep[];
  };
  /** Whether to expose the stack panel (PDA). */
  hasStack?: boolean;
  /** Whether to expose the tape panel (TM). */
  hasTape?: boolean;
  /** Mealy / Moore per-edge or per-state outputs, if any. */
  outputs?: Array<{ key: string; value: string }>;
  /** Document headline carried over from the engine (rendered in sidebar). */
  headline?: { title?: string; summary?: string };
  /** Engine-emitted prose/tables/derivations not already represented by the
   * structured fields above. Rendered by the sidebar. */
  content?: WorkspaceContentBlock[];
}

export type ControlTopicTag = string;

export interface ControlComplex {
  re: number;
  im: number;
}

export interface ControlTfMeta {
  /** Human-readable form (engine's display string). */
  display: string;
  /** Polynomial coefficients ordered low-power → high-power. */
  numerator: number[];
  denominator: number[];
  poles: ControlComplex[];
  zeros: ControlComplex[];
  /** Denominator degree. */
  order: number;
  /** System type — number of pure integrators (poles at origin). */
  systemType: number;
}

export interface ControlStabilityMeta {
  stable: boolean;
  /** Open- or closed-loop RHP pole count (subject to topic). */
  rhpPoles?: number;
  /** Bode/Nyquist gain margin in dB, when computed. */
  gainMarginDb?: number | null;
  /** Bode/Nyquist phase margin in degrees, when computed. */
  phaseMarginDeg?: number | null;
  /** Gain-crossover frequency (rad/s), when computed. */
  wcg?: number | null;
  /** Phase-crossover frequency (rad/s), when computed. */
  wcp?: number | null;
}

export interface ControlRouthMeta {
  headers: string[];
  rows: string[][];
}

export interface ControlReductionStepMeta {
  description: string;
}

export interface ControlMasonPathMeta {
  label: string;
  path: string;
  gain: string;
}

export interface ControlMasonMeta {
  forwardPaths: ControlMasonPathMeta[];
  loops: ControlMasonPathMeta[];
  /** Mason's gain final transfer-function string. */
  transferFunction: string;
}

export type ControlPlotKind =
  | 'bode-magnitude'
  | 'bode-phase'
  | 'pole-zero'
  | 'polar'
  | 'root-locus'
  | 'time-response'
  | 'block-diagram'
  | 'signal-flow-graph'
  | 'other';

export interface ControlPlotRef {
  title: string;
  kind: ControlPlotKind;
}

export interface ControlMeta {
  kind: 'control';
  topic: ControlTopicTag;
  tf?: ControlTfMeta;
  stability?: ControlStabilityMeta;
  routh?: ControlRouthMeta;
  /** Step-by-step block-diagram reduction trace. */
  reduction?: ControlReductionStepMeta[];
  /** Mason's gain decomposition, when applicable. */
  mason?: ControlMasonMeta;
  /** Plots produced by the engine — used by the inspector for navigation. */
  plots?: ControlPlotRef[];
  /** Document headline carried over from the engine (rendered in sidebar). */
  headline?: { title?: string; summary?: string };
  /** Engine-emitted prose/equations/matrices/tables not already represented
   * by the structured fields above. Rendered by the sidebar. */
  content?: WorkspaceContentBlock[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** When assistant produced a solution, attach a question reference */
  solvedQuestionId?: string;
  /** When assistant refused, attach refusal info */
  refusal?: { reason: string; manualInstructions: string[] };
  createdAt: number;
}
