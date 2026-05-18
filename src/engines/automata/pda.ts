import type { PDA, PDATransition } from './types';

/**
 * PDA constructors for canonical CFL examples.
 * All PDAs here accept by final state with bottom-of-stack symbol 'Z'.
 *
 * Transition notation in the diagram label: "a, X / γ" means
 *   - read input 'a' (or ε)
 *   - pop top stack symbol X (or ε to skip pop)
 *   - push string γ (right-to-left so first char ends up on top)
 */

export function buildEqualAB_PDA(): PDA {
  // Language L = { a^n b^n : n >= 0 } (or n >= 1 if no ε in start) — we support n>=0.
  // States: q0 (push a's), q1 (pop a's matching b's), q2 (accept)
  const transitions: PDATransition[] = [
    // ε,Z/Z → accept empty string
    { from: 'q0', input: '', popTop: 'Z', to: 'q2', push: 'Z' },
    // a, Z / AZ
    { from: 'q0', input: 'a', popTop: 'Z', to: 'q0', push: 'AZ' },
    // a, A / AA
    { from: 'q0', input: 'a', popTop: 'A', to: 'q0', push: 'AA' },
    // b, A / ε  (start matching)
    { from: 'q0', input: 'b', popTop: 'A', to: 'q1', push: '' },
    // b, A / ε  (continue matching)
    { from: 'q1', input: 'b', popTop: 'A', to: 'q1', push: '' },
    // ε, Z / Z  (done — bottom showing)
    { from: 'q1', input: '', popTop: 'Z', to: 'q2', push: 'Z' },
  ];
  return {
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['A', 'Z'],
    start: 'q0',
    initialStack: 'Z',
    accepting: new Set(['q2']),
    transitions,
    acceptMode: 'final',
  };
}

export function buildPalindromePDA(): PDA {
  // L = { ww^R : w ∈ {a,b}* } over alphabet {a,b}.
  // Nondeterministic: at any moment, guess we've reached the middle.
  const transitions: PDATransition[] = [
    // Push phase
    { from: 'q0', input: 'a', popTop: 'Z', to: 'q0', push: 'AZ' },
    { from: 'q0', input: 'b', popTop: 'Z', to: 'q0', push: 'BZ' },
    { from: 'q0', input: 'a', popTop: 'A', to: 'q0', push: 'AA' },
    { from: 'q0', input: 'a', popTop: 'B', to: 'q0', push: 'AB' },
    { from: 'q0', input: 'b', popTop: 'A', to: 'q0', push: 'BA' },
    { from: 'q0', input: 'b', popTop: 'B', to: 'q0', push: 'BB' },
    // ε-guess: switch to pop mode
    { from: 'q0', input: '', popTop: 'A', to: 'q1', push: 'A' },
    { from: 'q0', input: '', popTop: 'B', to: 'q1', push: 'B' },
    { from: 'q0', input: '', popTop: 'Z', to: 'q1', push: 'Z' },
    // Pop phase
    { from: 'q1', input: 'a', popTop: 'A', to: 'q1', push: '' },
    { from: 'q1', input: 'b', popTop: 'B', to: 'q1', push: '' },
    // Accept on empty stack except Z
    { from: 'q1', input: '', popTop: 'Z', to: 'q2', push: 'Z' },
  ];
  return {
    states: ['q0', 'q1', 'q2'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['A', 'B', 'Z'],
    start: 'q0',
    initialStack: 'Z',
    accepting: new Set(['q2']),
    transitions,
    acceptMode: 'final',
  };
}

export function buildBalancedParensPDA(): PDA {
  // L = balanced ( ) strings.
  const transitions: PDATransition[] = [
    { from: 'q0', input: '(', popTop: 'Z', to: 'q0', push: '(Z' },
    { from: 'q0', input: '(', popTop: '(', to: 'q0', push: '((' },
    { from: 'q0', input: ')', popTop: '(', to: 'q0', push: '' },
    { from: 'q0', input: '', popTop: 'Z', to: 'q1', push: 'Z' },
  ];
  return {
    states: ['q0', 'q1'],
    inputAlphabet: ['(', ')'],
    stackAlphabet: ['(', 'Z'],
    start: 'q0',
    initialStack: 'Z',
    accepting: new Set(['q1']),
    transitions,
    acceptMode: 'final',
  };
}

/**
 * Convert a PDA to an AutomatonView-like representation for rendering, where
 * each transition's label encodes "a, X / γ".
 */
export function pdaToView(pda: PDA, title: string, summary: string) {
  // Reuse Automaton machinery but encode label as the symbol string.
  const states = pda.states;
  const delta = new Map<string, Map<string, Set<string>>>();
  const symbols = new Set<string>();
  for (const t of pda.transitions) {
    const sym = `${t.input || 'ε'}, ${t.popTop || 'ε'} / ${t.push || 'ε'}`;
    symbols.add(sym);
    if (!delta.has(t.from)) delta.set(t.from, new Map());
    const row = delta.get(t.from)!;
    if (!row.has(sym)) row.set(sym, new Set());
    row.get(sym)!.add(t.to);
  }
  return {
    alphabet: [...symbols].sort(),
    states,
    start: pda.start,
    accepting: pda.accepting,
    delta,
    title,
    summary,
    layout: states.length > 5 ? 'two-rows' as const : 'row' as const,
  };
}
