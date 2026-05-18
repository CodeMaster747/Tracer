import {
  addTransition,
  emptyDelta,
  type Automaton,
  type AutomatonView,
} from './types';

/**
 * Minimal regex AST and Thompson's construction.
 *
 * Supported:
 *   atom    : literal | '(' regex ')'
 *   factor  : atom ('*' | '+' | '?')?
 *   term    : factor+               (concatenation)
 *   regex   : term ('|' term)*       (alternation)
 *
 * Special: 'ε' or 'eps' represents the empty string.
 * Whitespace is ignored.
 */

type Node =
  | { type: 'lit'; ch: string }
  | { type: 'eps' }
  | { type: 'concat'; a: Node; b: Node }
  | { type: 'or'; a: Node; b: Node }
  | { type: 'star'; a: Node }
  | { type: 'plus'; a: Node }
  | { type: 'opt'; a: Node };

class Parser {
  private i = 0;
  constructor(private src: string) {}

  parse(): Node {
    const r = this.parseRegex();
    this.skipSpace();
    if (this.i < this.src.length) {
      throw new Error(`Unexpected character at index ${this.i}: '${this.peek()}'`);
    }
    return r;
  }

  private skipSpace() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }

  private peek(): string {
    return this.src[this.i] ?? '';
  }

  private eat(c: string): boolean {
    this.skipSpace();
    if (this.peek() === c) {
      this.i++;
      return true;
    }
    return false;
  }

  private parseRegex(): Node {
    let left = this.parseTerm();
    while (true) {
      this.skipSpace();
      if (!this.eat('|')) break;
      const right = this.parseTerm();
      left = { type: 'or', a: left, b: right };
    }
    return left;
  }

  private parseTerm(): Node {
    const factors: Node[] = [];
    while (true) {
      this.skipSpace();
      const c = this.peek();
      if (c === '' || c === '|' || c === ')') break;
      factors.push(this.parseFactor());
    }
    if (factors.length === 0) return { type: 'eps' };
    return factors.reduce((a, b) => ({ type: 'concat', a, b }));
  }

  private parseFactor(): Node {
    let atom = this.parseAtom();
    while (true) {
      this.skipSpace();
      const c = this.peek();
      if (c === '*') {
        this.i++;
        atom = { type: 'star', a: atom };
      } else if (c === '+') {
        this.i++;
        atom = { type: 'plus', a: atom };
      } else if (c === '?') {
        this.i++;
        atom = { type: 'opt', a: atom };
      } else break;
    }
    return atom;
  }

  private parseAtom(): Node {
    this.skipSpace();
    const c = this.peek();
    if (c === '(') {
      this.i++;
      const inner = this.parseRegex();
      this.skipSpace();
      if (!this.eat(')')) throw new Error('Missing closing parenthesis');
      return inner;
    }
    if (c === '') throw new Error('Unexpected end of input');
    if (c === '|' || c === '*' || c === '+' || c === '?' || c === ')') {
      throw new Error(`Unexpected '${c}' at index ${this.i}`);
    }
    // Special tokens
    if (this.src.slice(this.i).match(/^(ε|eps)\b/i)) {
      const m = this.src.slice(this.i).match(/^(ε|eps)/i)!;
      this.i += m[0].length;
      return { type: 'eps' };
    }
    this.i++;
    return { type: 'lit', ch: c };
  }
}

export function parseRegex(src: string): Node {
  return new Parser(src).parse();
}

interface FragmentMachine {
  states: string[];
  delta: Automaton['delta'];
  start: string;
  accept: string;
  alphabet: Set<string>;
}

class NfaBuilder {
  private counter = 0;
  fresh(): string {
    return `n${this.counter++}`;
  }
}

function thompson(node: Node, b: NfaBuilder, alphabet: Set<string>): FragmentMachine {
  const start = b.fresh();
  const accept = b.fresh();
  const delta = emptyDelta();

  const merge = (other: FragmentMachine, intoStates: string[]) => {
    for (const s of other.states) intoStates.push(s);
    for (const [from, row] of other.delta) {
      for (const [sym, set] of row) {
        for (const to of set) addTransition(delta, from, sym, to);
      }
    }
  };

  switch (node.type) {
    case 'eps': {
      addTransition(delta, start, '', accept);
      return {
        states: [start, accept],
        delta,
        start,
        accept,
        alphabet,
      };
    }
    case 'lit': {
      alphabet.add(node.ch);
      addTransition(delta, start, node.ch, accept);
      return {
        states: [start, accept],
        delta,
        start,
        accept,
        alphabet,
      };
    }
    case 'concat': {
      const a = thompson(node.a, b, alphabet);
      const c = thompson(node.b, b, alphabet);
      const states: string[] = [];
      merge(a, states);
      merge(c, states);
      // ε from a.accept → c.start
      addTransition(delta, a.accept, '', c.start);
      return {
        states,
        delta,
        start: a.start,
        accept: c.accept,
        alphabet,
      };
    }
    case 'or': {
      const a = thompson(node.a, b, alphabet);
      const c = thompson(node.b, b, alphabet);
      const states = [start, accept];
      merge(a, states);
      merge(c, states);
      addTransition(delta, start, '', a.start);
      addTransition(delta, start, '', c.start);
      addTransition(delta, a.accept, '', accept);
      addTransition(delta, c.accept, '', accept);
      return {
        states,
        delta,
        start,
        accept,
        alphabet,
      };
    }
    case 'star': {
      const a = thompson(node.a, b, alphabet);
      const states = [start, accept];
      merge(a, states);
      addTransition(delta, start, '', a.start);
      addTransition(delta, start, '', accept);
      addTransition(delta, a.accept, '', a.start);
      addTransition(delta, a.accept, '', accept);
      return {
        states,
        delta,
        start,
        accept,
        alphabet,
      };
    }
    case 'plus': {
      // a+ ≡ aa*
      const a1 = thompson(node.a, b, alphabet);
      const a2 = thompson({ type: 'star', a: node.a }, b, alphabet);
      const states: string[] = [];
      merge(a1, states);
      merge(a2, states);
      addTransition(delta, a1.accept, '', a2.start);
      return {
        states,
        delta,
        start: a1.start,
        accept: a2.accept,
        alphabet,
      };
    }
    case 'opt': {
      // a? ≡ (a|ε)
      return thompson(
        { type: 'or', a: node.a, b: { type: 'eps' } },
        b,
        alphabet
      );
    }
  }
}

/**
 * Build an NFA (with ε-transitions) from a regex via Thompson construction.
 */
export function buildRegexNfa(regexSrc: string): AutomatonView {
  const ast = parseRegex(regexSrc);
  const builder = new NfaBuilder();
  const alphabet = new Set<string>();
  const frag = thompson(ast, builder, alphabet);
  // Insert ε into alphabet so the layout draws ε-arrows
  const alphabetList = ['', ...[...alphabet].sort()];

  // Re-name for readability: q0, q1, q2 ...
  const ordered = [frag.start, ...frag.states.filter((s) => s !== frag.start && s !== frag.accept), frag.accept];
  const dedup = Array.from(new Set(ordered));
  const renaming = new Map<string, string>();
  dedup.forEach((s, i) => renaming.set(s, `q${i}`));

  const renamedDelta = emptyDelta();
  for (const [from, row] of frag.delta) {
    for (const [sym, set] of row) {
      for (const to of set) {
        addTransition(
          renamedDelta,
          renaming.get(from) ?? from,
          sym,
          renaming.get(to) ?? to
        );
      }
    }
  }

  return {
    alphabet: alphabetList,
    states: dedup.map((s) => renaming.get(s)!),
    start: renaming.get(frag.start)!,
    accepting: new Set([renaming.get(frag.accept)!]),
    delta: renamedDelta,
    title: `NFA for /${regexSrc.trim()}/  (Thompson construction)`,
    summary: `Each operator in the regex translates to an NFA fragment with a fresh start and accept state, joined by ε-transitions: literals are direct edges, concatenation chains fragments, alternation forks via two ε-edges from a new start to the two operands and merges via two ε-edges to a new accept, and star wraps a fragment with bypass and feedback ε-edges. The result has exactly one accepting state and uses ε-transitions extensively — convert with the subset construction (NFA → DFA) to obtain a DFA.`,
    layout: dedup.length > 8 ? 'two-rows' : 'row',
  };
}
