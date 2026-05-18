import type { Automaton } from './types';

/**
 * Convert a DFA/NFA to an equivalent regular expression using the state
 * elimination method (Brzozowski / Arden's theorem in matrix form).
 *
 * Steps:
 *  1. Build a generalized transition matrix with regex labels between each
 *     pair of states.
 *  2. Introduce fresh start S and final F connected by ε to original.
 *  3. Eliminate every non-{S,F} state in turn; when removing q, for every
 *     pair (i,j) with i,j ≠ q update R(i,j) := R(i,j) | R(i,q) R(q,q)* R(q,j).
 *  4. The label R(S,F) is the regex.
 *
 * The trace records each intermediate matrix so the reader can follow.
 */

export interface RegexElimResult {
  regex: string;
  trace: string[];
}

function paren(r: string): string {
  if (r === '' || r === 'ε' || r === '∅') return r;
  // Single symbol or already parenthesized → no extra parens
  if (/^[A-Za-z0-9ε∅]$/.test(r)) return r;
  if (r.startsWith('(') && r.endsWith(')') && balanced(r)) return r;
  return `(${r})`;
}

function balanced(r: string): boolean {
  let depth = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i] === '(') depth++;
    else if (r[i] === ')') {
      depth--;
      if (depth === 0 && i !== r.length - 1) return false;
    }
  }
  return depth === 0;
}

function union(a: string, b: string): string {
  if (a === '∅') return b;
  if (b === '∅') return a;
  if (a === b) return a;
  return `${a}|${b}`;
}

function concat(a: string, b: string): string {
  if (a === '∅' || b === '∅') return '∅';
  if (a === 'ε') return b;
  if (b === 'ε') return a;
  return paren(a) + paren(b);
}

function star(a: string): string {
  if (a === '∅' || a === 'ε') return 'ε';
  if (a.length === 1) return `${a}*`;
  return `${paren(a)}*`;
}

export function dfaToRegex(a: Automaton): RegexElimResult {
  const states = [...a.states];

  // Build label matrix R[i][j] = union of symbols on i→j (or ε if i=j, ∅ otherwise initially).
  const R: Record<string, Record<string, string>> = {};
  for (const i of states) {
    R[i] = {};
    for (const j of states) R[i][j] = '∅';
  }
  for (const [from, row] of a.delta) {
    for (const [sym, set] of row) {
      const s = sym === '' ? 'ε' : sym;
      for (const to of set) {
        R[from][to] = union(R[from][to], s);
      }
    }
  }

  // Introduce fresh S and F
  const S = '__S__';
  const F = '__F__';
  const ext = [S, ...states, F];
  const M: Record<string, Record<string, string>> = {};
  for (const i of ext) {
    M[i] = {};
    for (const j of ext) M[i][j] = '∅';
  }
  for (const i of states) {
    for (const j of states) M[i][j] = R[i][j];
  }
  M[S][a.start] = 'ε';
  for (const acc of a.accepting) M[acc][F] = 'ε';

  const trace: string[] = [];
  trace.push('Generalized NFA built. Eliminate intermediate states one at a time.');

  // Eliminate every non-{S,F} state in order of states[]
  const remaining = [...states];
  while (remaining.length > 0) {
    // Pick the state whose removal produces the simplest update (smallest in/out)
    // For determinism we just remove in order.
    const q = remaining.shift()!;
    const loop = star(M[q][q]);
    const ins = ext.filter((i) => i !== q && M[i][q] !== '∅');
    const outs = ext.filter((j) => j !== q && M[q][j] !== '∅');
    for (const i of ins) {
      for (const j of outs) {
        const detour = concat(concat(M[i][q], loop), M[q][j]);
        M[i][j] = union(M[i][j], detour);
      }
    }
    // Remove q from the matrix
    for (const i of ext) {
      delete M[i][q];
    }
    delete M[q];
    const idx = ext.indexOf(q);
    if (idx >= 0) ext.splice(idx, 1);
    trace.push(`Eliminate ${q}: R(${S},${F}) = ${M[S][F]}`);
  }

  const regex = M[S][F] === '∅' ? '∅' : M[S][F];
  trace.push(`Final regex: ${regex}`);
  return { regex, trace };
}
