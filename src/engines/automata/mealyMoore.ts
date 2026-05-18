import { addTransition, emptyDelta, type AutomatonView } from './types';

/**
 * Convert a Moore machine to an equivalent Mealy machine.
 * Moore: output is a function of the state.   λ(q): state → outputAlphabet
 * Mealy: output is a function of (state, input). λ'(q,a): state×Σ → outputAlphabet
 *
 * Construction: λ'(q,a) = λ(δ(q,a)).  States and transitions are unchanged.
 */
export function mooreToMealy(moore: AutomatonView): AutomatonView {
  if (moore.outputMode !== 'moore') {
    throw new Error('mooreToMealy: input is not a Moore machine');
  }
  const stateOutputs = moore.outputs ?? new Map<string, string>();
  const mealyOutputs = new Map<string, string>();
  for (const [from, row] of moore.delta) {
    for (const [sym, set] of row) {
      for (const to of set) {
        mealyOutputs.set(`${from}|${sym}|${to}`, stateOutputs.get(to) ?? '');
      }
    }
  }
  return {
    alphabet: moore.alphabet,
    states: moore.states,
    start: moore.start,
    accepting: moore.accepting,
    delta: moore.delta,
    outputs: mealyOutputs,
    outputMode: 'mealy',
    title: 'Mealy machine equivalent of the Moore machine',
    summary:
      'For each transition (p, a, q), the Mealy output equals the Moore state output of the destination q. States and transitions are unchanged.',
    layout: moore.layout,
  };
}

/**
 * Convert a Mealy machine to an equivalent Moore machine.
 *
 * Construction: split each state q into copies (q, o) — one per distinct output
 * value that any transition into q produces. Connect (p,*) — on symbol a — to
 * (q, λ(p, a)) where δ(p, a) = q. The new state's Moore output is the second
 * component. The start state's output is unspecified; emit ε.
 */
export function mealyToMoore(mealy: AutomatonView): AutomatonView {
  if (mealy.outputMode !== 'mealy') {
    throw new Error('mealyToMoore: input is not a Mealy machine');
  }
  const transOut = mealy.outputs ?? new Map<string, string>();
  const symbols = mealy.alphabet.filter((s) => s !== '');

  // Collect all output values reaching each state (and the start gets a fresh "no-output" copy)
  const outsAt = new Map<string, Set<string>>();
  for (const s of mealy.states) outsAt.set(s, new Set());
  for (const [from, row] of mealy.delta) {
    for (const [sym, set] of row) {
      for (const to of set) {
        outsAt.get(to)!.add(transOut.get(`${from}|${sym}|${to}`) ?? '');
      }
    }
  }
  // Make sure start has at least one copy
  if (outsAt.get(mealy.start)!.size === 0) outsAt.get(mealy.start)!.add('-');

  const stateName = (q: string, o: string) => `${q}/${o || '-'}`;
  const newStates: string[] = [];
  const stateOutputs = new Map<string, string>();
  const accepting = new Set<string>();
  for (const q of mealy.states) {
    for (const o of outsAt.get(q)!) {
      const name = stateName(q, o);
      newStates.push(name);
      stateOutputs.set(name, o || '');
      if (mealy.accepting.has(q)) accepting.add(name);
    }
  }

  const newDelta = emptyDelta();
  for (const q of mealy.states) {
    for (const o of outsAt.get(q)!) {
      for (const sym of symbols) {
        const set = mealy.delta.get(q)?.get(sym);
        if (!set) continue;
        for (const r of set) {
          const oOut = transOut.get(`${q}|${sym}|${r}`) ?? '';
          addTransition(newDelta, stateName(q, o), sym, stateName(r, oOut));
        }
      }
    }
  }

  // Pick a unique start copy (with output '-')
  const startCopy = stateName(mealy.start, [...outsAt.get(mealy.start)!][0]);

  return {
    alphabet: mealy.alphabet,
    states: newStates,
    start: startCopy,
    accepting,
    delta: newDelta,
    outputs: stateOutputs,
    outputMode: 'moore',
    title: 'Moore machine equivalent of the Mealy machine',
    summary:
      'Each Mealy state q is split into copies (q, o) keyed by the output value that lands on q. The new Moore output of (q, o) is o. Transitions retain their input symbol but lose explicit outputs.',
    layout: newStates.length > 5 ? 'two-rows' : 'row',
  };
}

/**
 * Build a Moore machine that, on every input symbol, outputs the residue
 * (length mod k). Useful canonical example.
 */
export function buildLengthModMoore(alphabet: string, k: number): AutomatonView {
  const sigma = [...new Set(alphabet)];
  const states = Array.from({ length: k }, (_, i) => `q${i}`);
  const delta = emptyDelta();
  const outputs = new Map<string, string>();
  for (let i = 0; i < k; i++) {
    outputs.set(`q${i}`, String(i));
    for (const c of sigma) addTransition(delta, `q${i}`, c, `q${(i + 1) % k}`);
  }
  return {
    alphabet: sigma,
    states,
    start: 'q0',
    accepting: new Set(),
    delta,
    outputs,
    outputMode: 'moore',
    title: `Moore machine: output |w| mod ${k}`,
    summary: `State qᵢ outputs i and transitions to q(i+1 mod ${k}) on every input. After reading n symbols the machine is in q(n mod ${k}) and outputs n mod ${k}.`,
    layout: k > 5 ? 'circle' : 'row',
  };
}

/**
 * Build a Mealy machine over {0,1} that outputs '1' iff the last two input
 * bits form '01' (a simple edge detector). Canonical Mealy example.
 */
export function buildEdgeDetectorMealy(): AutomatonView {
  const states = ['q0', 'q1'];
  const delta = emptyDelta();
  const outputs = new Map<string, string>();
  // q0 = last bit was 0 (or no input).  q1 = last bit was 1.
  addTransition(delta, 'q0', '0', 'q0');
  outputs.set('q0|0|q0', '0');
  addTransition(delta, 'q0', '1', 'q1');
  outputs.set('q0|1|q1', '0');
  addTransition(delta, 'q1', '0', 'q0');
  outputs.set('q1|0|q0', '0');
  addTransition(delta, 'q1', '1', 'q1');
  outputs.set('q1|1|q1', '0');
  // Output 1 when 0 → 1 edge
  outputs.set('q0|1|q1', '1');
  return {
    alphabet: ['0', '1'],
    states,
    start: 'q0',
    accepting: new Set(),
    delta,
    outputs,
    outputMode: 'mealy',
    title: 'Mealy machine: rising-edge (01) detector',
    summary: 'Outputs 1 exactly when a 0 is immediately followed by a 1; otherwise outputs 0. State q0 = last bit 0 (or start), q1 = last bit 1.',
  };
}
