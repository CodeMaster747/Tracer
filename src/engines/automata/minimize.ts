import { addTransition, emptyDelta, type Automaton, type AutomatonView } from './types';

/**
 * Remove unreachable states from a DFA.
 */
export function removeUnreachable(a: Automaton): Automaton {
  const reachable = new Set<string>([a.start]);
  const stack = [a.start];
  while (stack.length) {
    const s = stack.pop()!;
    const row = a.delta.get(s);
    if (!row) continue;
    for (const [, set] of row) {
      for (const t of set) {
        if (!reachable.has(t)) {
          reachable.add(t);
          stack.push(t);
        }
      }
    }
  }
  const states = a.states.filter((s) => reachable.has(s));
  const delta = emptyDelta();
  for (const s of states) {
    const row = a.delta.get(s);
    if (!row) continue;
    for (const [sym, set] of row) {
      for (const t of set) if (reachable.has(t)) addTransition(delta, s, sym, t);
    }
  }
  return {
    alphabet: a.alphabet,
    states,
    start: a.start,
    accepting: new Set([...a.accepting].filter((s) => reachable.has(s))),
    delta,
  };
}

/**
 * Make a DFA total by adding a dead/trap state for missing transitions.
 * Returns the original automaton if it is already total.
 */
export function completeDfa(a: Automaton): Automaton {
  const symbols = a.alphabet.filter((s) => s !== '');
  let needTrap = false;
  for (const s of a.states) {
    for (const sym of symbols) {
      const set = a.delta.get(s)?.get(sym);
      if (!set || set.size === 0) {
        needTrap = true;
        break;
      }
    }
    if (needTrap) break;
  }
  if (!needTrap) return a;

  const trap = pickFreshName(a.states, 'qd');
  const states = [...a.states, trap];
  const delta = emptyDelta();
  for (const [from, row] of a.delta) {
    for (const [sym, set] of row) {
      for (const to of set) addTransition(delta, from, sym, to);
    }
  }
  for (const s of states) {
    for (const sym of symbols) {
      const set = delta.get(s)?.get(sym);
      if (!set || set.size === 0) addTransition(delta, s, sym, trap);
    }
  }
  return {
    alphabet: a.alphabet,
    states,
    start: a.start,
    accepting: a.accepting,
    delta,
  };
}

function pickFreshName(existing: string[], base: string): string {
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}${i}`)) i++;
  return `${base}${i}`;
}

/**
 * Partition-refinement DFA minimization. Returns the minimized automaton plus
 * a trace of the partitions at each refinement step (useful for step-by-step
 * solutions and table-filling-style explanations).
 */
export function minimizeDfa(
  input: Automaton
): { minimized: Automaton; trace: string[]; partitions: string[][][] } {
  const trace: string[] = [];

  trace.push('Step 1 — Remove unreachable states.');
  const reached = removeUnreachable(input);
  if (reached.states.length < input.states.length) {
    const removed = input.states.filter((s) => !reached.states.includes(s));
    trace.push(`  Unreachable: {${removed.join(', ')}}.`);
  } else {
    trace.push('  All states reachable.');
  }

  trace.push('Step 2 — Complete the DFA (add trap state if needed).');
  const dfa = completeDfa(reached);
  if (dfa.states.length > reached.states.length) {
    trace.push(`  Added trap state ${dfa.states[dfa.states.length - 1]} for missing transitions.`);
  }

  const symbols = dfa.alphabet.filter((s) => s !== '');

  // Initial partition: accepting vs non-accepting.
  let partition: Set<string>[] = [];
  const acc = new Set(dfa.states.filter((s) => dfa.accepting.has(s)));
  const nonacc = new Set(dfa.states.filter((s) => !dfa.accepting.has(s)));
  if (acc.size) partition.push(acc);
  if (nonacc.size) partition.push(nonacc);

  const partitions: string[][][] = [partition.map((p) => [...p].sort())];
  trace.push(
    `Step 3 — Initial partition (accepting | non-accepting):  ${partitionToString(partition)}`
  );

  // Iteratively refine
  let changed = true;
  let iter = 0;
  while (changed) {
    changed = false;
    iter++;
    const next: Set<string>[] = [];
    const blockOf = (state: string): number =>
      partition.findIndex((b) => b.has(state));

    for (const block of partition) {
      const groups = new Map<string, Set<string>>();
      for (const s of block) {
        const sig = symbols
          .map((sym) => {
            const set = dfa.delta.get(s)?.get(sym);
            const to = set ? [...set][0] : undefined;
            return to ? blockOf(to) : -1;
          })
          .join(',');
        if (!groups.has(sig)) groups.set(sig, new Set());
        groups.get(sig)!.add(s);
      }
      if (groups.size > 1) changed = true;
      for (const g of groups.values()) next.push(g);
    }
    partition = next;
    partitions.push(partition.map((p) => [...p].sort()));
    trace.push(`Iteration ${iter}: ${partitionToString(partition)}`);
    if (iter > 200) break; // safety
  }

  // Build minimized DFA from partition
  const blockName = (b: Set<string>) => `[${[...b].sort().join(',')}]`;
  const blockOfState = new Map<string, Set<string>>();
  for (const b of partition) for (const s of b) blockOfState.set(s, b);

  const newStates = partition.map((b) => blockName(b));
  const newDelta = emptyDelta();
  for (const b of partition) {
    const rep = [...b][0];
    for (const sym of symbols) {
      const set = dfa.delta.get(rep)?.get(sym);
      if (!set) continue;
      const to = [...set][0];
      const tgtBlock = blockOfState.get(to);
      if (!tgtBlock) continue;
      addTransition(newDelta, blockName(b), sym, blockName(tgtBlock));
    }
  }
  const newStart = blockName(blockOfState.get(dfa.start)!);
  const newAcc = new Set(
    partition
      .filter((b) => [...b].some((s) => dfa.accepting.has(s)))
      .map((b) => blockName(b))
  );

  // Drop trap state (block whose every transition self-loops and which is non-accepting)
  const isTrap = (b: Set<string>): boolean => {
    const name = blockName(b);
    if (newAcc.has(name)) return false;
    for (const sym of symbols) {
      const set = newDelta.get(name)?.get(sym);
      if (!set) return false;
      if (![...set].every((t) => t === name)) return false;
    }
    return true;
  };
  const trapBlocks = partition.filter(isTrap).map(blockName);

  // Re-label states as M0, M1, ...
  const ordered = newStates.filter((s) => !trapBlocks.includes(s));
  // Make sure start is first
  ordered.sort((a, b) => (a === newStart ? -1 : b === newStart ? 1 : 0));
  const rename = new Map<string, string>();
  ordered.forEach((s, i) => rename.set(s, `M${i}`));

  const finalDelta = emptyDelta();
  for (const [from, row] of newDelta) {
    if (!rename.has(from)) continue;
    for (const [sym, set] of row) {
      for (const to of set) {
        if (!rename.has(to)) continue; // drop edges into trap
        addTransition(finalDelta, rename.get(from)!, sym, rename.get(to)!);
      }
    }
  }

  const minimized: Automaton = {
    alphabet: dfa.alphabet.filter((s) => s !== ''),
    states: ordered.map((s) => rename.get(s)!),
    start: rename.get(newStart)!,
    accepting: new Set([...newAcc].filter((s) => rename.has(s)).map((s) => rename.get(s)!)),
    delta: finalDelta,
  };

  trace.push(
    `Step 4 — Final partition stable. Minimized DFA has ${minimized.states.length} states (was ${input.states.length}).`
  );

  return { minimized, trace, partitions };
}

function partitionToString(p: Set<string>[]): string {
  return p.map((b) => `{${[...b].sort().join(', ')}}`).join('  ');
}

export function minimizeDfaView(view: AutomatonView): AutomatonView {
  const { minimized } = minimizeDfa(view);
  return {
    ...minimized,
    title: `Minimized DFA (${minimized.states.length} states)`,
    summary: 'Equivalent DFA obtained by partition refinement, with unreachable states and the trap (if any) removed.',
    layout: minimized.states.length > 5 ? 'two-rows' : 'row',
  };
}
