/**
 * Core types for the deep Automata Theory engine.
 * Covers FAs (DFA/NFA/ε-NFA), Mealy/Moore, PDAs, Turing Machines, CFGs,
 * parse trees, simulation traces, and renderable solution documents.
 */

export interface Automaton {
  /** Symbols include the empty string '' for epsilon transitions */
  alphabet: string[];
  states: string[];
  start: string;
  accepting: Set<string>;
  /** state -> symbol -> set of next states (NFA-friendly; DFAs have singletons) */
  delta: Map<string, Map<string, Set<string>>>;
}

export interface AutomatonView extends Automaton {
  combineParallel?: boolean;
  layout?: 'row' | 'two-rows' | 'circle' | 'grid';
  title: string;
  summary: string;
  /**
   * Per-state output labels (Moore machines) or per-transition outputs (Mealy machines).
   * For Mealy: keyed as `${from}|${symbol}|${to}`.
   */
  outputs?: Map<string, string>;
  outputMode?: 'mealy' | 'moore';
}

export function emptyDelta(): Automaton['delta'] {
  return new Map();
}

export function addTransition(
  delta: Automaton['delta'],
  from: string,
  symbol: string,
  to: string
): void {
  let row = delta.get(from);
  if (!row) {
    row = new Map();
    delta.set(from, row);
  }
  let set = row.get(symbol);
  if (!set) {
    set = new Set();
    row.set(symbol, set);
  }
  set.add(to);
}

export function getTransitions(
  delta: Automaton['delta'],
  from: string,
  symbol: string
): Set<string> {
  return delta.get(from)?.get(symbol) ?? new Set();
}

export function cloneDelta(d: Automaton['delta']): Automaton['delta'] {
  const out = emptyDelta();
  for (const [from, row] of d) {
    for (const [sym, set] of row) {
      for (const to of set) addTransition(out, from, sym, to);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pushdown Automaton                                                  */
/* ------------------------------------------------------------------ */

export interface PDATransition {
  from: string;
  input: string;        // '' = ε
  popTop: string;       // symbol popped from stack ('' = no pop, but we usually require a pop)
  to: string;
  push: string;         // string pushed (right-to-left onto stack; '' = pop only)
}

export interface PDA {
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  start: string;
  initialStack: string; // bottom-of-stack symbol
  accepting: Set<string>;
  transitions: PDATransition[];
  /** 'final' = accept by entering accepting state; 'empty' = accept by empty stack */
  acceptMode: 'final' | 'empty';
}

/* ------------------------------------------------------------------ */
/* Turing Machine                                                      */
/* ------------------------------------------------------------------ */

export interface TMTransition {
  from: string;
  read: string;
  to: string;
  write: string;
  move: 'L' | 'R' | 'S';
}

export interface TuringMachine {
  states: string[];
  inputAlphabet: string[];
  tapeAlphabet: string[];
  blank: string;
  start: string;
  accepting: Set<string>;
  reject?: string;
  transitions: TMTransition[];
  numTapes?: number;
}

/* ------------------------------------------------------------------ */
/* Context-Free Grammar                                                */
/* ------------------------------------------------------------------ */

export interface Production {
  lhs: string;          // a single nonterminal
  rhs: string[];        // sequence of symbols; ['ε'] or [] = epsilon production
}

export interface Grammar {
  nonterminals: Set<string>;
  terminals: Set<string>;
  start: string;
  productions: Production[];
}

/* ------------------------------------------------------------------ */
/* Parse Tree                                                          */
/* ------------------------------------------------------------------ */

export interface ParseTreeNode {
  label: string;
  isTerminal?: boolean;
  children: ParseTreeNode[];
}

/* ------------------------------------------------------------------ */
/* Simulation Trace                                                    */
/* ------------------------------------------------------------------ */

export interface SimulationStep {
  index: number;
  consumed: string;
  remaining: string;
  state: string;        // for DFA — single state name
  symbol?: string;      // symbol just read
  states?: string[];    // for NFA — multiple active states
}

export interface SimulationResult {
  accepted: boolean;
  steps: SimulationStep[];
  input: string;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Document (multi-section renderable solution)                        */
/* ------------------------------------------------------------------ */

export type DocSection =
  | { kind: 'automaton'; view: AutomatonView }
  | { kind: 'text-block'; title?: string; lines: string[]; mono?: boolean }
  | { kind: 'table'; title?: string; headers: string[]; rows: string[][]; highlightRows?: Set<number>; highlightCols?: Set<number> }
  | { kind: 'parse-tree'; title?: string; root: ParseTreeNode }
  | { kind: 'tm-tape'; title?: string; tape: string[]; head: number; state: string }
  | { kind: 'derivation'; title?: string; steps: string[] };

export interface SolutionDoc {
  title: string;
  summary: string;
  sections: DocSection[];
}
