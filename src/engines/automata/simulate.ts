import type { Automaton, SimulationResult, SimulationStep } from './types';

/**
 * Compute ε-closure of a set of NFA states.
 */
export function epsilonClosure(a: Automaton, set: Set<string>): Set<string> {
  const out = new Set(set);
  const stack = [...set];
  while (stack.length) {
    const s = stack.pop()!;
    const eps = a.delta.get(s)?.get('');
    if (!eps) continue;
    for (const t of eps) {
      if (!out.has(t)) {
        out.add(t);
        stack.push(t);
      }
    }
  }
  return out;
}

/**
 * Move a set of NFA states under a single symbol (no ε-closure).
 */
export function move(a: Automaton, set: Set<string>, symbol: string): Set<string> {
  const out = new Set<string>();
  for (const s of set) {
    const next = a.delta.get(s)?.get(symbol);
    if (!next) continue;
    for (const t of next) out.add(t);
  }
  return out;
}

/**
 * Simulate any FA (DFA, NFA, or ε-NFA) on an input string.
 * Returns a per-step trace plus accept/reject verdict.
 */
export function simulate(a: Automaton, input: string): SimulationResult {
  const symbols = [...input];

  // Detect symbols not in alphabet
  for (const c of symbols) {
    if (!a.alphabet.includes(c) && c !== '') {
      return {
        accepted: false,
        steps: [],
        input,
        reason: `Symbol '${c}' is not in the alphabet {${a.alphabet
          .filter((s) => s !== '')
          .join(', ')}}.`,
      };
    }
  }

  let current = epsilonClosure(a, new Set([a.start]));
  const steps: SimulationStep[] = [
    {
      index: 0,
      consumed: '',
      remaining: input,
      state: a.start,
      states: [...current].sort(),
    },
  ];

  for (let i = 0; i < symbols.length; i++) {
    const c = symbols[i];
    current = epsilonClosure(a, move(a, current, c));
    steps.push({
      index: i + 1,
      consumed: symbols.slice(0, i + 1).join(''),
      remaining: symbols.slice(i + 1).join(''),
      state: [...current].sort().join(',') || '∅',
      symbol: c,
      states: [...current].sort(),
    });
    if (current.size === 0) {
      return {
        accepted: false,
        steps,
        input,
        reason: `After reading '${c}', no states are reachable (rejected).`,
      };
    }
  }

  const accepted = [...current].some((s) => a.accepting.has(s));
  return {
    accepted,
    steps,
    input,
    reason: accepted
      ? `Final state set ${formatSet(current)} contains an accepting state.`
      : `Final state set ${formatSet(current)} contains no accepting state.`,
  };
}

function formatSet(s: Set<string>): string {
  return `{${[...s].sort().join(', ')}}`;
}

/**
 * Produce a transition-table representation of an automaton.
 * For NFAs, cells are comma-separated state lists; ε column appears if any.
 */
export function transitionTable(a: Automaton): { headers: string[]; rows: string[][] } {
  const hasEps = a.states.some((s) => (a.delta.get(s)?.get('')?.size ?? 0) > 0);
  const symbols = a.alphabet.filter((s) => s !== '');
  const headers = ['δ', ...symbols, ...(hasEps ? ['ε'] : [])];
  const rows: string[][] = [];
  for (const s of a.states) {
    const row: string[] = [];
    const marker =
      s === a.start && a.accepting.has(s)
        ? '↔'
        : s === a.start
          ? '→'
          : a.accepting.has(s)
            ? '*'
            : ' ';
    row.push(`${marker} ${s}`);
    for (const sym of symbols) {
      const set = a.delta.get(s)?.get(sym);
      if (!set || set.size === 0) row.push('—');
      else row.push([...set].sort().join(','));
    }
    if (hasEps) {
      const set = a.delta.get(s)?.get('');
      if (!set || set.size === 0) row.push('—');
      else row.push([...set].sort().join(','));
    }
    rows.push(row);
  }
  return { headers, rows };
}
