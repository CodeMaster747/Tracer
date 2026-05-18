import {
  buildContainsDfa,
  buildDivisibleByDfa,
  buildEndsWithDfa,
  buildLengthModDfa,
  buildParityDfa,
  buildStartsWithDfa,
  nfaToDfa,
} from './constructors';
import { buildRegexNfa } from './regex';
import { minimizeDfa, minimizeDfaView } from './minimize';
import { simulate, transitionTable } from './simulate';
import { dfaToRegex } from './dfaToRegex';
import {
  buildEdgeDetectorMealy,
  buildLengthModMoore,
  mealyToMoore,
  mooreToMealy,
} from './mealyMoore';
import { parseGrammar, formatGrammar, simplifyGrammar, toCNF, toGNF } from './cfg';
import { buildLL1Table, firstFollowToTable, ll1TableToTable } from './ll1';
import { deriveParseTree } from './parseTree';
import {
  buildBalancedParensPDA,
  buildEqualAB_PDA,
  buildPalindromePDA,
  pdaToView,
} from './pda';
import { buildAnBnCn_TM, buildIncrementBinary_TM, simulateTM, tmToView } from './turing';
import type { AutomatonView, DocSection, SolutionDoc } from './types';

export interface ParseResult {
  doc: SolutionDoc | null;
  refusal?: string;
}

/**
 * Backward-compat wrapper retaining the {view, refusal} shape used by callers
 * that just want a single automaton diagram.
 */
export interface LegacyParseResult {
  view: AutomatonView | null;
  refusal?: string;
}

/* --- alphabet & sequence helpers ----------------------------------- */

const ALPHABET_RE = /(?:over|alphabet)\s*[:=]?\s*\{([^}]+)\}/i;
function parseAlphabet(text: string, fallback = '01'): string {
  const m = text.match(ALPHABET_RE);
  if (m && m[1]) return m[1].replace(/[\s,]+/g, '');
  if (/\bbinary\b/i.test(text)) return '01';
  return fallback;
}
function defaultAlphabetForSeq(seq: string): string {
  const chars = [...new Set(seq)];
  if (chars.every((c) => c === '0' || c === '1')) return '01';
  return chars.join('');
}

/* --- single-view helpers -------------------------------------------- */

function viewToDoc(view: AutomatonView, extra: DocSection[] = []): SolutionDoc {
  const table = transitionTable(view);
  return {
    title: view.title,
    summary: view.summary,
    sections: [
      { kind: 'automaton', view },
      { kind: 'table', title: 'Transition table', headers: table.headers, rows: table.rows },
      ...extra,
    ],
  };
}

/* --- regex extraction ----------------------------------------------- */

const PATTERN_REGEX_INLINE = /\/(.+?)\/\s*(?:thompson|nfa|regex)?/i;
const PATTERN_REGEX_FOR = /(?:thompson|regex|regular\s+expression).*?(?:for|construct|of)\s*[\/`'"]?([^"'`\n]+?)[\/`'"]?\s*$/i;
const REGEX_RAW = /\bregex\s+([^\s,;]+)/i;

function extractRegex(t: string): string | null {
  const m1 = t.match(PATTERN_REGEX_INLINE);
  if (m1) return m1[1].trim();
  const m2 = t.match(PATTERN_REGEX_FOR);
  if (m2) return m2[1].trim();
  const m3 = t.match(REGEX_RAW);
  if (m3) return m3[1].trim();
  return null;
}

/* --- grammar extraction --------------------------------------------- */

function extractGrammar(t: string): string | null {
  // Lines containing -> or → or ::= are likely grammar productions.
  const lines = t.split(/\n+/).map((l) => l.trim());
  const prodLines = lines.filter((l) => /->|→|::=/.test(l));
  if (prodLines.length === 0) return null;
  return prodLines.join('\n');
}

const RESERVED_NEAR_INPUT = new Set([
  'alphabet',
  'string',
  'strings',
  'language',
  'grammar',
  'symbol',
  'symbols',
  'word',
  'words',
  'is',
  'are',
  'the',
]);

/* --- string-to-test extraction --------------------------------------- */

function extractInputString(t: string): string | null {
  // "X is accepted" / "whether X is accepted" / "X is in the language"
  let m = t.match(/['"`]?([0-9a-zA-Z()+*]+)['"`]?\s+is\s+(?:accept|in\s+the\s+language|belong)/i);
  if (m) return m[1];
  // "on input X"
  m = t.match(/\bon\s+input\s+['"`]?([0-9a-zA-Z()+*]+)['"`]?/i);
  if (m) return m[1];
  // "input: X" or "input X" or "input is X"
  m = t.match(/\binput\s*[:=]\s*['"`]?([0-9a-zA-Z()+*]+)['"`]?/i);
  if (m) return m[1];
  m = t.match(/\binput\s+(?:is\s+|the\s+string\s+)?['"`]([0-9a-zA-Z()+*]+)['"`]/i);
  if (m) return m[1];
  m = t.match(/\binput\s+([0-9a-zA-Z()+*]+)\b/i);
  if (m && !RESERVED_NEAR_INPUT.has(m[1].toLowerCase())) return m[1];
  // "accept(s|ed) the string X" or "rejects 'X'"
  m = t.match(/\b(?:accept(?:s|ed)?|reject(?:s|ed)?)\s+(?:the\s+)?(?:string\s+)?['"`]([0-9a-zA-Z()+*]+)['"`]/i);
  if (m) return m[1];
  // Quoted after simulate/trace/run/test
  m = t.match(/\b(?:simulate|trace|run|test)\s+(?:the\s+\w+\s+)?(?:on\s+)?['"`]([0-9a-zA-Z()+*]+)['"`]/i);
  if (m) return m[1];
  return null;
}

/* --- DFA construction dispatcher ------------------------------------ */

function tryBuildAutomatonFromText(t: string): AutomatonView | null {
  // 1) Regex first
  const r = extractRegex(t);
  if (r) {
    try {
      return buildRegexNfa(r);
    } catch {
      // fall through
    }
  }

  // 2) Length-mod / divisibility
  const lenDiv = t.match(/length\s+(?:is\s+)?divisible\s+by\s+(\d+)/i);
  if (lenDiv) {
    const k = parseInt(lenDiv[1], 10);
    if (k > 0) return buildLengthModDfa(parseAlphabet(t), k, 0);
  }
  const lenMod = t.match(/length\s+mod(?:ulo)?\s+(\d+)\s*(?:=|is|equals?)\s*(\d+)/i);
  if (lenMod) {
    const k = parseInt(lenMod[1], 10);
    const r2 = parseInt(lenMod[2], 10);
    if (k > 0 && Number.isFinite(r2)) return buildLengthModDfa(parseAlphabet(t), k, r2);
  }

  // Divisibility for binary
  const divBin = t.match(/(?:binary\s+(?:strings?|numbers?)?\s*(?:that\s+are\s+)?divisible\s+by|divisible\s+by)\s+(\d+)/i);
  if (divBin) {
    const n = parseInt(divBin[1], 10);
    if (n > 0) return buildDivisibleByDfa(n);
  }

  // Ends / starts / contains
  const endM = t.match(/(?:ending|ends?)\s*(?:in|with)\s*['"`]?([0-9a-zA-Z]+)['"`]?/i);
  if (endM) {
    const suffix = endM[1];
    const alpha = parseAlphabet(t, defaultAlphabetForSeq(suffix));
    if ([...suffix].every((c) => alpha.includes(c))) return buildEndsWithDfa(alpha, suffix);
  }
  const startM = t.match(/(?:starting|starts?)\s*with\s*['"`]?([0-9a-zA-Z]+)['"`]?/i);
  if (startM) {
    const prefix = startM[1];
    const alpha = parseAlphabet(t, defaultAlphabetForSeq(prefix));
    if ([...prefix].every((c) => alpha.includes(c))) return buildStartsWithDfa(alpha, prefix);
  }
  const conQ = t.match(/(?:contain(?:ing|s)?|having|with)\s+(?:the\s+)?(?:substring|pattern|sub-?string)?\s*['"`]([0-9a-zA-Z]+)['"`]/i);
  if (conQ) {
    const sub = conQ[1];
    const alpha = parseAlphabet(t, defaultAlphabetForSeq(sub));
    if ([...sub].every((c) => alpha.includes(c))) return buildContainsDfa(alpha, sub);
  }
  const conB = t.match(/(?:contain(?:ing|s)?)\s+([0-9a-zA-Z]+)\b/i);
  if (conB && conB[1].length <= 8) {
    const sub = conB[1];
    const alpha = parseAlphabet(t, defaultAlphabetForSeq(sub));
    if ([...sub].every((c) => alpha.includes(c))) return buildContainsDfa(alpha, sub);
  }

  // Even / odd parity
  const evenM = t.match(/even\s+(?:number|count)?\s*(?:of)?\s*['"`]?([0-9a-zA-Z])['"`]?(?:s)?/i);
  if (evenM) return buildParityDfa(parseAlphabet(t), evenM[1], true);
  const oddM = t.match(/odd\s+(?:number|count)?\s*(?:of)?\s*['"`]?([0-9a-zA-Z])['"`]?(?:s)?/i);
  if (oddM) return buildParityDfa(parseAlphabet(t), oddM[1], false);

  return null;
}

/* --- Main parser ---------------------------------------------------- */

export function parseAutomataDoc(text: string): ParseResult {
  const t = text.trim();
  if (!t) return { doc: null, refusal: 'Empty question.' };

  /* ----------------- TM tasks ----------------- */
  if (/\bturing\b/i.test(t) || /\bTM\b/.test(t)) {
    if (/a\^?n\s*b\^?n\s*c\^?n/i.test(t) || /\ba+b+c+\b/i.test(t)) {
      const tm = buildAnBnCn_TM();
      const view = tmToView(
        tm,
        'Turing Machine for L = { aⁿbⁿcⁿ : n ≥ 1 }',
        'On each pass, mark leftmost a as A, then the leftmost b as B, then the leftmost c as C, and rewind. Accept when only marks (and blank) remain.'
      );
      const inputStr = extractInputString(t) ?? 'aabbcc';
      const sim = simulateTM(tm, inputStr, 80);
      const sections: DocSection[] = [
        { kind: 'automaton', view },
      ];
      sim.configurations.slice(0, 8).forEach((cfg, i) =>
        sections.push({
          kind: 'tm-tape',
          title: i === 0 ? `Tape trace on "${inputStr}"` : undefined,
          tape: cfg.tape,
          head: cfg.head,
          state: cfg.state,
        })
      );
      sections.push({
        kind: 'text-block',
        title: 'Result',
        lines: [`Input "${inputStr}" — ${sim.accepted ? 'ACCEPTED' : 'rejected'} after ${sim.configurations.length - 1} steps.`],
      });
      return { doc: { title: view.title, summary: view.summary, sections } };
    }
    if (/increment|successor|\+1|add\s+one/i.test(t) && /binary/i.test(t)) {
      const tm = buildIncrementBinary_TM();
      const view = tmToView(tm, 'Turing Machine: binary increment', 'Walk right to end of input, then propagate carry leftward by flipping 1→0 until a 0 (or blank) is found, which becomes 1.');
      const inputStr = extractInputString(t) ?? '1011';
      const sim = simulateTM(tm, inputStr);
      const sections: DocSection[] = [
        { kind: 'automaton', view },
      ];
      sim.configurations.slice(0, 10).forEach((cfg, i) =>
        sections.push({
          kind: 'tm-tape',
          title: i === 0 ? `Tape trace on "${inputStr}"` : undefined,
          tape: cfg.tape,
          head: cfg.head,
          state: cfg.state,
        })
      );
      return { doc: { title: view.title, summary: view.summary, sections } };
    }
    return {
      doc: null,
      refusal:
        'For Turing machines I can construct: a^n b^n c^n decider, and a binary-increment machine. Add an example string with "on input ...".',
    };
  }

  /* ----------------- PDA tasks ----------------- */
  if (/\bpda\b|\bpushdown\b/i.test(t)) {
    if (/palindrome/i.test(t)) {
      const pda = buildPalindromePDA();
      const view = pdaToView(pda, 'PDA for L = { ww^R : w ∈ {a,b}* }', 'Non-deterministic. In q0 push each input symbol; at any point ε-guess the middle and transition to q1; in q1 pop matching symbols. Accept when stack returns to bottom Z.');
      return { doc: viewToDoc(view as AutomatonView) };
    }
    if (/balanc/i.test(t) || /paren|bracket/i.test(t)) {
      const pda = buildBalancedParensPDA();
      const view = pdaToView(pda, 'PDA for balanced parentheses', "On '(' push to stack; on ')' pop. ε-transition to accept when only Z remains on the stack.");
      return { doc: viewToDoc(view as AutomatonView) };
    }
    // Default: a^n b^n
    const pda = buildEqualAB_PDA();
    const view = pdaToView(pda, 'PDA for L = { aⁿbⁿ : n ≥ 0 }', "Push 'A' for each 'a' read; on each 'b' pop one 'A'; accept when stack returns to Z.");
    return { doc: viewToDoc(view as AutomatonView) };
  }

  /* ----------------- Grammar tasks ----------------- */
  const grammarSrc = extractGrammar(t);
  if (grammarSrc) {
    const g = parseGrammar(grammarSrc);
    // CNF?
    if (/\bchomsky\b|\bCNF\b/i.test(t)) {
      const r = toCNF(g);
      return {
        doc: {
          title: `Chomsky Normal Form of grammar with start ${g.start}`,
          summary: 'Conversion: simplify (remove ε, unit, useless), shadow terminals in long RHS, then binarize all long productions.',
          sections: [
            { kind: 'text-block', title: 'Original grammar', lines: formatGrammar(g) },
            { kind: 'text-block', title: 'Trace', lines: r.trace },
            { kind: 'text-block', title: 'CNF grammar', lines: formatGrammar(r.grammar), mono: true },
          ],
        },
      };
    }
    if (/\bgreibach\b|\bGNF\b/i.test(t)) {
      const r = toGNF(g);
      return {
        doc: {
          title: `Greibach Normal Form (best-effort) of grammar with start ${g.start}`,
          summary: 'GNF conversion: CNF → order non-terminals → eliminate left recursion → back-substitute leading non-terminals with terminals.',
          sections: [
            { kind: 'text-block', title: 'Original grammar', lines: formatGrammar(g) },
            { kind: 'text-block', title: 'Trace', lines: r.trace },
            { kind: 'text-block', title: 'GNF grammar', lines: formatGrammar(r.grammar), mono: true },
          ],
        },
      };
    }
    if (/\bsimplif/i.test(t) || /\bremove\b.*\b(epsilon|unit|useless|null)\b/i.test(t)) {
      const r = simplifyGrammar(g);
      return {
        doc: {
          title: `Simplified grammar with start ${g.start}`,
          summary: 'Apply: (1) remove ε-productions, (2) remove unit productions, (3) remove useless symbols.',
          sections: [
            { kind: 'text-block', title: 'Original grammar', lines: formatGrammar(g) },
            { kind: 'text-block', title: 'Trace', lines: r.trace },
            { kind: 'text-block', title: 'Simplified grammar', lines: formatGrammar(r.grammar), mono: true },
          ],
        },
      };
    }
    if (/\bLL\(1\)\b|\bLL1\b|\bpars(e|ing)\s+table\b/i.test(t)) {
      const ll1 = buildLL1Table(g);
      const ff = firstFollowToTable(g, ll1);
      const tbl = ll1TableToTable(g, ll1);
      return {
        doc: {
          title: 'LL(1) parsing analysis',
          summary: ll1.isLL1
            ? 'Grammar is LL(1). FIRST, FOLLOW and the parse table are shown.'
            : 'Grammar has LL(1) conflicts. Conflicts and partial table are shown below.',
          sections: [
            { kind: 'text-block', title: 'Grammar', lines: formatGrammar(g) },
            { kind: 'table', title: 'FIRST and FOLLOW', headers: ff.headers, rows: ff.rows },
            { kind: 'table', title: 'LL(1) parse table', headers: tbl.headers, rows: tbl.rows },
            ...(ll1.conflicts.length
              ? [{ kind: 'text-block', title: 'Conflicts', lines: ll1.conflicts } as DocSection]
              : []),
          ],
        },
      };
    }
    if (/\bFIRST\b/i.test(t) || /\bFOLLOW\b/i.test(t)) {
      const ll1 = buildLL1Table(g);
      const ff = firstFollowToTable(g, ll1);
      return {
        doc: {
          title: 'FIRST and FOLLOW sets',
          summary: 'Computed by iterative fixed-point. FIRST(α) starts a derivation; FOLLOW(A) is the set of terminals that can follow A.',
          sections: [
            { kind: 'text-block', title: 'Grammar', lines: formatGrammar(g) },
            { kind: 'table', title: 'FIRST / FOLLOW', headers: ff.headers, rows: ff.rows },
          ],
        },
      };
    }
    // Parse tree?
    const inputStr = extractInputString(t);
    if (/\bparse\s+tree\b|\bderivation\b/i.test(t) && inputStr !== null) {
      const tree = deriveParseTree(g, inputStr);
      if (!tree) {
        return { doc: null, refusal: `Could not derive "${inputStr}" from this grammar.` };
      }
      return {
        doc: {
          title: `Parse tree for "${inputStr}"`,
          summary: 'Top-down derivation via LL(1) when applicable, otherwise depth-limited search.',
          sections: [
            { kind: 'text-block', title: 'Grammar', lines: formatGrammar(g) },
            { kind: 'derivation', title: 'Leftmost derivation', steps: tree.derivation },
            { kind: 'parse-tree', title: 'Parse tree', root: tree.root },
          ],
        },
      };
    }
  }

  /* ----------------- Mealy / Moore ----------------- */
  if (/\bmealy\b/i.test(t) && /\bmoore\b/i.test(t) && /convert|equival|to/i.test(t)) {
    // Default: convert canonical Mealy edge detector to its Moore form
    const m = buildEdgeDetectorMealy();
    const moore = mealyToMoore(m);
    return {
      doc: {
        title: 'Mealy → Moore conversion',
        summary: 'Each Mealy state is split into copies indexed by the output value that arrives there. The new Moore output of (q, o) is o.',
        sections: [
          { kind: 'automaton', view: m },
          { kind: 'automaton', view: moore },
        ],
      },
    };
  }
  if (/\bmealy\b/i.test(t)) {
    const m = buildEdgeDetectorMealy();
    return { doc: viewToDoc(m) };
  }
  if (/\bmoore\b/i.test(t)) {
    const k = parseInt((t.match(/mod(?:ulo)?\s+(\d+)/i) ?? [])[1] ?? '3', 10);
    const m = buildLengthModMoore(parseAlphabet(t), k);
    if (/\bto\s+mealy\b/i.test(t)) {
      const mealy = mooreToMealy(m);
      return {
        doc: {
          title: 'Moore → Mealy conversion',
          summary: "The Mealy output for transition (p, a, q) equals the Moore state output of q. States and transitions are unchanged.",
          sections: [
            { kind: 'automaton', view: m },
            { kind: 'automaton', view: mealy },
          ],
        },
      };
    }
    return { doc: viewToDoc(m) };
  }

  /* ----------------- FA construction + transformations ----------------- */

  // First try to build an automaton from the textual description
  const view = tryBuildAutomatonFromText(t);

  // DFA → Regex (state elimination / Arden)
  if (view && (/\bto\s+regex\b/i.test(t) || /\bregular\s+expression\b/i.test(t) || /\barden\b/i.test(t) || /\bstate\s+elimination\b/i.test(t))) {
    const { regex, trace } = dfaToRegex(view);
    return {
      doc: {
        title: `Regular expression equivalent`,
        summary: 'Convert the FA to a regex by state elimination (a matrix form of Arden\'s theorem).',
        sections: [
          { kind: 'automaton', view },
          { kind: 'text-block', title: 'Elimination steps', lines: trace },
          { kind: 'text-block', title: 'Resulting regex', lines: [regex] },
        ],
      },
    };
  }

  // Minimize
  if (view && /\bminimi[sz]/i.test(t)) {
    const { minimized, trace } = minimizeDfa(view);
    const minView = minimizeDfaView(view);
    return {
      doc: {
        title: `Minimized DFA (${minimized.states.length} states)`,
        summary: 'Minimization via partition refinement: start with {accepting, non-accepting} and refine until stable, then drop the trap.',
        sections: [
          { kind: 'automaton', view },
          { kind: 'text-block', title: 'Minimization trace', lines: trace },
          { kind: 'automaton', view: minView },
        ],
      },
    };
  }

  // NFA → DFA (works with regex inputs which produce ε-NFAs too)
  if (view && /\b(nfa|ε[- ]?nfa|epsilon[- ]?nfa)\s*(?:to|→|\->|->|into)\s*dfa\b|\bsubset\s+construction\b/i.test(t)) {
    const dfaView = nfaToDfa(view);
    return {
      doc: {
        title: 'NFA → DFA (subset construction)',
        summary: 'Each DFA state is the ε-closure of a subset of NFA states reachable by some input prefix. A DFA state is accepting iff its subset contains any NFA accept state.',
        sections: [
          { kind: 'automaton', view },
          { kind: 'automaton', view: dfaView },
        ],
      },
    };
  }

  // String simulation
  const inputStr = view ? extractInputString(t) : null;
  if (view && inputStr !== null && /\b(accept|simulate|trace|run|check)/i.test(t)) {
    const sim = simulate(view, inputStr);
    const headers = ['#', 'Consumed', 'Remaining', 'Active states'];
    const rows = sim.steps.map((s) => [
      String(s.index),
      s.consumed || 'ε',
      s.remaining || 'ε',
      s.states ? `{${s.states.join(', ')}}` : s.state,
    ]);
    return {
      doc: {
        title: `Simulation on "${inputStr}"`,
        summary: sim.reason ?? '',
        sections: [
          { kind: 'automaton', view },
          { kind: 'table', title: 'Step-by-step trace', headers, rows },
          { kind: 'text-block', lines: [sim.accepted ? `Result: ACCEPTED` : 'Result: rejected'] },
        ],
      },
    };
  }

  // Default: just build the automaton
  if (view) {
    return { doc: viewToDoc(view) };
  }

  return {
    doc: null,
    refusal:
      'I could not match this to a known automata pattern. Try one of: ' +
      '"DFA ending in 01", "binary strings divisible by 5", "NFA to DFA for /(a|b)*abb/", ' +
      '"minimize DFA for ending in 01", "DFA to regex for length divisible by 3", ' +
      '"simulate DFA on input 1011 ending in 01", "construct PDA for a^n b^n", ' +
      '"Turing machine for a^n b^n c^n on input aabbcc", ' +
      '"CNF for S -> aSb | ε", "FIRST and FOLLOW for E -> E+T|T; T -> T*F|F; F -> (E)|id".',
  };
}

/* --- legacy entry point retained for any external callers ----------- */

export function parseAutomataQuestion(text: string): LegacyParseResult {
  const r = parseAutomataDoc(text);
  if (!r.doc) return { view: null, refusal: r.refusal };
  // Find first automaton section
  const sec = r.doc.sections.find((s) => s.kind === 'automaton');
  if (sec && sec.kind === 'automaton') {
    return { view: sec.view };
  }
  return { view: null, refusal: 'Result has no automaton view.' };
}
