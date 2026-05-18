import type { TMTransition, TuringMachine } from './types';

/**
 * Canonical Turing machine constructors.
 */

/**
 * TM that decides L = { a^n b^n c^n : n >= 1 } over input alphabet {a,b,c}.
 * Uses marks A, B, C on tape; blank = '_'.
 *
 * Strategy: from leftmost unmarked 'a', mark as A; scan right past A/b/B to
 * find an unmarked b, mark as B; continue right past B/c/C to find an unmarked
 * c, mark as C; rewind to start; repeat. Accept when after rewind no 'a' is
 * found and remaining tape is balanced.
 */
export function buildAnBnCn_TM(): TuringMachine {
  const t: TMTransition[] = [];
  // State naming: q0 (start), q1 (find b), q2 (find c), q3 (rewind), qa (accept), qr (reject)
  const blank = '_';
  // Read 'a' → mark as A and go right
  t.push({ from: 'q0', read: 'a', to: 'q1', write: 'A', move: 'R' });
  // Already saw all a's (head on B or _) → must verify only B/C/blank remains then accept
  t.push({ from: 'q0', read: 'B', to: 'q4', write: 'B', move: 'R' });
  t.push({ from: 'q0', read: '_', to: 'qa', write: '_', move: 'S' });

  // q1: skip a or B; find an unmarked b
  for (const ch of ['a', 'B']) t.push({ from: 'q1', read: ch, to: 'q1', write: ch, move: 'R' });
  t.push({ from: 'q1', read: 'b', to: 'q2', write: 'B', move: 'R' });

  // q2: skip b or C; find an unmarked c
  for (const ch of ['b', 'C']) t.push({ from: 'q2', read: ch, to: 'q2', write: ch, move: 'R' });
  t.push({ from: 'q2', read: 'c', to: 'q3', write: 'C', move: 'L' });

  // q3: rewind to the leftmost A then move right one more
  for (const ch of ['a', 'b', 'c', 'A', 'B', 'C']) t.push({ from: 'q3', read: ch, to: 'q3', write: ch, move: 'L' });
  t.push({ from: 'q3', read: '_', to: 'q0', write: '_', move: 'R' });

  // q4: verify only C remaining
  t.push({ from: 'q4', read: 'C', to: 'q4', write: 'C', move: 'R' });
  t.push({ from: 'q4', read: '_', to: 'qa', write: '_', move: 'S' });

  return {
    states: ['q0', 'q1', 'q2', 'q3', 'q4', 'qa'],
    inputAlphabet: ['a', 'b', 'c'],
    tapeAlphabet: ['a', 'b', 'c', 'A', 'B', 'C', blank],
    blank,
    start: 'q0',
    accepting: new Set(['qa']),
    transitions: t,
  };
}

/**
 * TM that increments a binary number on the tape (MSB-first).
 */
export function buildIncrementBinary_TM(): TuringMachine {
  const t: TMTransition[] = [];
  // q0: scan right to end of input
  t.push({ from: 'q0', read: '0', to: 'q0', write: '0', move: 'R' });
  t.push({ from: 'q0', read: '1', to: 'q0', write: '1', move: 'R' });
  t.push({ from: 'q0', read: '_', to: 'q1', write: '_', move: 'L' });
  // q1: carry-propagate left
  t.push({ from: 'q1', read: '0', to: 'qa', write: '1', move: 'S' });
  t.push({ from: 'q1', read: '1', to: 'q1', write: '0', move: 'L' });
  t.push({ from: 'q1', read: '_', to: 'qa', write: '1', move: 'S' });
  return {
    states: ['q0', 'q1', 'qa'],
    inputAlphabet: ['0', '1'],
    tapeAlphabet: ['0', '1', '_'],
    blank: '_',
    start: 'q0',
    accepting: new Set(['qa']),
    transitions: t,
  };
}

/**
 * Convert a Turing machine to an AutomatonView-like structure for diagram
 * rendering. Label format: "read / write, dir".
 */
export function tmToView(tm: TuringMachine, title: string, summary: string) {
  const delta = new Map<string, Map<string, Set<string>>>();
  const symbols = new Set<string>();
  for (const t of tm.transitions) {
    const sym = `${t.read}/${t.write},${t.move}`;
    symbols.add(sym);
    if (!delta.has(t.from)) delta.set(t.from, new Map());
    const row = delta.get(t.from)!;
    if (!row.has(sym)) row.set(sym, new Set());
    row.get(sym)!.add(t.to);
  }
  return {
    alphabet: [...symbols].sort(),
    states: tm.states,
    start: tm.start,
    accepting: tm.accepting,
    delta,
    title,
    summary,
    layout: tm.states.length > 5 ? 'two-rows' as const : 'row' as const,
  };
}

/**
 * Simulate a Turing machine for at most `maxSteps` steps and return the
 * sequence of (state, tape, head) configurations.
 */
export function simulateTM(
  tm: TuringMachine,
  input: string,
  maxSteps = 200
): {
  configurations: Array<{ state: string; tape: string[]; head: number }>;
  accepted: boolean;
} {
  const tape = input.length === 0 ? [tm.blank] : [...input];
  let head = 0;
  let state = tm.start;
  const cfgs: Array<{ state: string; tape: string[]; head: number }> = [
    { state, tape: [...tape], head },
  ];
  for (let step = 0; step < maxSteps; step++) {
    if (tm.accepting.has(state)) return { configurations: cfgs, accepted: true };
    const sym = tape[head] ?? tm.blank;
    const tr = tm.transitions.find((x) => x.from === state && x.read === sym);
    if (!tr) return { configurations: cfgs, accepted: false };
    tape[head] = tr.write;
    state = tr.to;
    if (tr.move === 'L') head--;
    else if (tr.move === 'R') head++;
    if (head < 0) {
      tape.unshift(tm.blank);
      head = 0;
    }
    if (head >= tape.length) tape.push(tm.blank);
    cfgs.push({ state, tape: [...tape], head });
  }
  return { configurations: cfgs, accepted: tm.accepting.has(state) };
}
