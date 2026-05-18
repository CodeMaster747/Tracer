import { addTransition, emptyDelta, type Automaton } from './types';
import { completeDfa } from './minimize';

/**
 * Check equivalence of two DFAs via product construction.
 * Two DFAs are equivalent iff for every reachable product state (p,q) we have
 * "p accepts iff q accepts".
 */
export function dfaEquivalent(
  a: Automaton,
  b: Automaton
): {
  equivalent: boolean;
  witness?: string;
  trace: string[];
} {
  if (a.alphabet.filter((s) => s !== '').sort().join('') !==
      b.alphabet.filter((s) => s !== '').sort().join('')) {
    return {
      equivalent: false,
      trace: [
        `Alphabets differ: A has {${a.alphabet.filter((s) => s !== '').join(',')}}, B has {${b.alphabet.filter((s) => s !== '').join(',')}}.`,
      ],
    };
  }
  const A = completeDfa(a);
  const B = completeDfa(b);
  const symbols = A.alphabet.filter((s) => s !== '');

  const trace: string[] = [];
  trace.push('Product construction. Visit pairs (p,q) reachable from (start_A,start_B).');

  type Pair = { p: string; q: string; path: string };
  const startPair: Pair = { p: A.start, q: B.start, path: '' };
  const visited = new Set<string>();
  const queue: Pair[] = [startPair];
  visited.add(`${A.start}|${B.start}`);

  while (queue.length) {
    const { p, q, path } = queue.shift()!;
    const pAcc = A.accepting.has(p);
    const qAcc = B.accepting.has(q);
    trace.push(`  (${p}, ${q})  via "${path || 'ε'}":  accept=${pAcc}/${qAcc}`);
    if (pAcc !== qAcc) {
      return {
        equivalent: false,
        witness: path,
        trace: [
          ...trace,
          `Mismatch found at (${p},${q}) with witness "${path || 'ε'}": ${pAcc ? 'A accepts' : 'A rejects'} but ${qAcc ? 'B accepts' : 'B rejects'}.`,
        ],
      };
    }
    for (const sym of symbols) {
      const pn = [...(A.delta.get(p)?.get(sym) ?? [])][0];
      const qn = [...(B.delta.get(q)?.get(sym) ?? [])][0];
      if (pn === undefined || qn === undefined) continue;
      const key = `${pn}|${qn}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ p: pn, q: qn, path: path + sym });
      }
    }
  }
  return {
    equivalent: true,
    trace: [...trace, 'No mismatching pair found ⇒ L(A) = L(B).'],
  };
}

/**
 * Product DFA accepting L(A) ∩ L(B) or L(A) ∪ L(B).
 */
export function product(
  a: Automaton,
  b: Automaton,
  mode: 'intersect' | 'union'
): Automaton {
  const A = completeDfa(a);
  const B = completeDfa(b);
  const symbols = A.alphabet.filter((s) => s !== '');

  const stateName = (p: string, q: string) => `(${p},${q})`;
  const start = stateName(A.start, B.start);
  const visited = new Set<string>([start]);
  const queue: Array<[string, string]> = [[A.start, B.start]];
  const states: string[] = [start];
  const delta = emptyDelta();
  const accepting = new Set<string>();

  while (queue.length) {
    const [p, q] = queue.shift()!;
    const name = stateName(p, q);
    const pa = A.accepting.has(p);
    const qa = B.accepting.has(q);
    if (mode === 'intersect' ? pa && qa : pa || qa) accepting.add(name);
    for (const sym of symbols) {
      const pn = [...(A.delta.get(p)?.get(sym) ?? [])][0];
      const qn = [...(B.delta.get(q)?.get(sym) ?? [])][0];
      if (pn === undefined || qn === undefined) continue;
      const next = stateName(pn, qn);
      addTransition(delta, name, sym, next);
      if (!visited.has(next)) {
        visited.add(next);
        states.push(next);
        queue.push([pn, qn]);
      }
    }
  }
  return { alphabet: symbols, states, start, accepting, delta };
}

/**
 * Complement of a DFA: complete it, then flip accepting/non-accepting.
 */
export function complement(a: Automaton): Automaton {
  const c = completeDfa(a);
  return {
    alphabet: c.alphabet,
    states: c.states,
    start: c.start,
    accepting: new Set(c.states.filter((s) => !c.accepting.has(s))),
    delta: c.delta,
  };
}
