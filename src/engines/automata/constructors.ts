import { addTransition, emptyDelta, type Automaton, type AutomatonView } from './types';

function uniq(s: string): string[] {
  return [...new Set(s)];
}

function dfaPrefixFn(prefixOf: string, prefix: string, c: string): string {
  // Longest suffix of (prefixOf + c) that is a prefix of `prefix`
  let candidate = prefixOf + c;
  while (candidate.length > 0) {
    if (prefix.startsWith(candidate)) return candidate;
    candidate = candidate.slice(1);
  }
  return '';
}

/**
 * DFA accepting strings over `alphabet` that contain `substring`.
 * Uses Aho-Corasick-style longest-prefix construction.
 */
export function buildContainsDfa(alphabet: string, substring: string): AutomatonView {
  const sigma = uniq(alphabet);
  const states: string[] = [];
  for (let i = 0; i <= substring.length; i++) {
    states.push(`q${i}`);
  }
  const delta = emptyDelta();

  for (let i = 0; i <= substring.length; i++) {
    const cur = substring.slice(0, i);
    if (i === substring.length) {
      // Already accepted; self-loop on all symbols
      for (const c of sigma) {
        addTransition(delta, `q${i}`, c, `q${i}`);
      }
    } else {
      for (const c of sigma) {
        const next = dfaPrefixFn(cur, substring, c);
        addTransition(delta, `q${i}`, c, `q${next.length}`);
      }
    }
  }

  return {
    alphabet: sigma,
    states,
    start: 'q0',
    accepting: new Set([`q${substring.length}`]),
    delta,
    title: `DFA: strings over {${sigma.join(',')}} containing "${substring}"`,
    summary: `A ${
      substring.length + 1
    }-state DFA. Each state qᵢ represents "the longest suffix of input read so far that is a prefix of '${substring}' has length i". The accepting state q${substring.length} marks "we have just seen ${substring} as a substring"; a self-loop on all symbols keeps us there.`,
  };
}

/**
 * DFA accepting strings over `alphabet` that end with `suffix`.
 */
export function buildEndsWithDfa(alphabet: string, suffix: string): AutomatonView {
  const sigma = uniq(alphabet);
  const states: string[] = [];
  for (let i = 0; i <= suffix.length; i++) states.push(`q${i}`);
  const delta = emptyDelta();

  for (let i = 0; i <= suffix.length; i++) {
    const cur = suffix.slice(0, i);
    for (const c of sigma) {
      const next = dfaPrefixFn(cur, suffix, c);
      addTransition(delta, `q${i}`, c, `q${next.length}`);
    }
  }

  return {
    alphabet: sigma,
    states,
    start: 'q0',
    accepting: new Set([`q${suffix.length}`]),
    delta,
    title: `DFA: strings over {${sigma.join(',')}} ending in "${suffix}"`,
    summary: `Each state qᵢ tracks "the longest suffix of input so far that matches a prefix of '${suffix}' has length i". The accepting state q${suffix.length} is reached only after input ending exactly in '${suffix}'. Note that, unlike the contains-DFA, the accepting state does NOT have a self-loop covering both symbols — incorrect characters take the machine back to a shorter prefix-match state.`,
  };
}

/**
 * DFA accepting strings over `alphabet` that start with `prefix`.
 */
export function buildStartsWithDfa(alphabet: string, prefix: string): AutomatonView {
  const sigma = uniq(alphabet);
  const states: string[] = [];
  for (let i = 0; i <= prefix.length; i++) states.push(`q${i}`);
  states.push('qd'); // dead/reject state
  const delta = emptyDelta();

  for (let i = 0; i < prefix.length; i++) {
    for (const c of sigma) {
      addTransition(
        delta,
        `q${i}`,
        c,
        c === prefix[i] ? `q${i + 1}` : 'qd'
      );
    }
  }
  for (const c of sigma) {
    addTransition(delta, `q${prefix.length}`, c, `q${prefix.length}`);
    addTransition(delta, 'qd', c, 'qd');
  }

  return {
    alphabet: sigma,
    states,
    start: 'q0',
    accepting: new Set([`q${prefix.length}`]),
    delta,
    title: `DFA: strings over {${sigma.join(',')}} starting with "${prefix}"`,
    summary: `A linear chain q0→q1→…→q${prefix.length} consumes the required prefix; any deviation takes the machine to the dead state qd, from which it cannot escape. After matching the prefix, q${prefix.length} self-loops on every symbol to accept arbitrary suffixes.`,
  };
}

/**
 * DFA accepting strings over `alphabet` whose length mod k == r.
 */
export function buildLengthModDfa(alphabet: string, k: number, r: number): AutomatonView {
  if (k <= 0) throw new Error('length-mod modulus must be positive');
  const sigma = uniq(alphabet);
  const states = Array.from({ length: k }, (_, i) => `q${i}`);
  const delta = emptyDelta();
  for (let i = 0; i < k; i++) {
    for (const c of sigma) {
      addTransition(delta, `q${i}`, c, `q${(i + 1) % k}`);
    }
  }
  return {
    alphabet: sigma,
    states,
    start: 'q0',
    accepting: new Set([`q${((r % k) + k) % k}`]),
    delta,
    title: `DFA: strings over {${sigma.join(',')}} with |w| mod ${k} = ${r}`,
    summary: `A ${k}-state cycle q0 → q1 → … → q${k - 1} → q0. Each input symbol advances by exactly one state regardless of value, so after reading n symbols we land in q(n mod ${k}). Accepting state is q${((r % k) + k) % k}.`,
    layout: k > 5 ? 'circle' : 'row',
  };
}

/**
 * DFA accepting strings with even/odd count of a symbol.
 */
export function buildParityDfa(alphabet: string, symbol: string, even: boolean): AutomatonView {
  const sigma = uniq(alphabet);
  if (!sigma.includes(symbol)) {
    throw new Error(`symbol "${symbol}" not in alphabet`);
  }
  const states = ['q0', 'q1'];
  const delta = emptyDelta();
  for (const c of sigma) {
    if (c === symbol) {
      addTransition(delta, 'q0', c, 'q1');
      addTransition(delta, 'q1', c, 'q0');
    } else {
      addTransition(delta, 'q0', c, 'q0');
      addTransition(delta, 'q1', c, 'q1');
    }
  }
  return {
    alphabet: sigma,
    states,
    start: 'q0',
    accepting: new Set([even ? 'q0' : 'q1']),
    delta,
    title: `DFA: ${even ? 'even' : 'odd'} number of '${symbol}' over {${sigma.join(',')}}`,
    summary: `Two states track the parity of '${symbol}'-count read so far: q0 = even, q1 = odd. Reading '${symbol}' toggles between them; reading any other symbol is a self-loop. ${
      even
        ? 'q0 is accepting (even, including zero).'
        : 'q1 is accepting (odd, at least one occurrence).'
    }`,
  };
}

/**
 * DFA accepting binary strings whose value (read MSB-first) is divisible by n.
 */
export function buildDivisibleByDfa(n: number): AutomatonView {
  if (n <= 0) throw new Error('divisor must be positive');
  const states = Array.from({ length: n }, (_, i) => `q${i}`);
  const delta = emptyDelta();
  for (let i = 0; i < n; i++) {
    addTransition(delta, `q${i}`, '0', `q${(2 * i) % n}`);
    addTransition(delta, `q${i}`, '1', `q${(2 * i + 1) % n}`);
  }
  return {
    alphabet: ['0', '1'],
    states,
    start: 'q0',
    accepting: new Set(['q0']),
    delta,
    title: `DFA: binary strings divisible by ${n}`,
    summary: `State qᵢ encodes "the value of the binary string read so far, mod ${n}, equals i". Reading bit b shifts value left by 1 and adds b: i → (2·i + b) mod ${n}. Start and accept on q0 (value ≡ 0 mod ${n}).`,
    layout: n > 5 ? 'circle' : 'row',
  };
}

/**
 * Subset construction: NFA → DFA.
 * The input NFA may have epsilon transitions (symbol '' represents ε).
 */
export function nfaToDfa(nfa: Automaton, friendlyTitle?: string): AutomatonView {
  const epsilonClose = (set: Set<string>): Set<string> => {
    const result = new Set(set);
    const stack = [...set];
    while (stack.length > 0) {
      const s = stack.pop()!;
      const eps = nfa.delta.get(s)?.get('') ?? new Set();
      for (const t of eps) {
        if (!result.has(t)) {
          result.add(t);
          stack.push(t);
        }
      }
    }
    return result;
  };

  const move = (set: Set<string>, sym: string): Set<string> => {
    const result = new Set<string>();
    for (const s of set) {
      const next = nfa.delta.get(s)?.get(sym) ?? new Set();
      for (const t of next) result.add(t);
    }
    return epsilonClose(result);
  };

  const setKey = (set: Set<string>): string => [...set].sort().join('|');
  const initial = epsilonClose(new Set([nfa.start]));
  const stateMap = new Map<string, Set<string>>();
  const ordered: string[] = [];
  const queue: Array<{ key: string; set: Set<string> }> = [];

  const ensure = (set: Set<string>): string => {
    const key = setKey(set);
    if (!stateMap.has(key)) {
      stateMap.set(key, set);
      ordered.push(key);
      queue.push({ key, set });
    }
    return key;
  };

  ensure(initial);

  const dfaDelta = emptyDelta();
  while (queue.length > 0) {
    const { key, set } = queue.shift()!;
    for (const sym of nfa.alphabet) {
      if (sym === '') continue;
      const nextSet = move(set, sym);
      if (nextSet.size === 0) continue;
      const nextKey = ensure(nextSet);
      addTransition(dfaDelta, key, sym, nextKey);
    }
  }

  // Rename states to D0, D1, ... for readability
  const renaming = new Map<string, string>();
  ordered.forEach((k, i) => renaming.set(k, `D${i}`));

  const renamedDelta = emptyDelta();
  for (const [from, row] of dfaDelta) {
    for (const [sym, set] of row) {
      for (const to of set) {
        addTransition(
          renamedDelta,
          renaming.get(from)!,
          sym,
          renaming.get(to)!
        );
      }
    }
  }

  const accepting = new Set<string>();
  for (const [key, set] of stateMap) {
    for (const s of set) {
      if (nfa.accepting.has(s)) {
        accepting.add(renaming.get(key)!);
        break;
      }
    }
  }

  return {
    alphabet: nfa.alphabet.filter((s) => s !== ''),
    states: ordered.map((k) => renaming.get(k)!),
    start: renaming.get(setKey(initial))!,
    accepting,
    delta: renamedDelta,
    title: friendlyTitle ?? 'NFA → DFA (subset construction)',
    summary: `The DFA states are subsets of NFA states reachable from the start under the input read so far (with ε-closure). Each new DFA state corresponds to such a subset, named D₀, D₁, … here. A DFA state is accepting iff its subset contains any NFA accepting state.`,
    layout: ordered.length > 5 ? 'two-rows' : 'row',
  };
}
