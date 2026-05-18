/**
 * Smoke test for the expanded Automata engine. Run with:
 *   npx tsx scripts/smoke-automata.ts
 */
import { solveAutomataQuestion } from '../src/engines/automata';

const cases = [
  // Original cases — must keep working
  'Construct an NFA accepting strings ending in 01',
  'DFA for binary strings divisible by 3',
  'DFA accepting strings of length divisible by 3',
  'Construct a DFA with even number of 0',
  'Construct a DFA accepting strings starting with abc over {a,b,c}',
  "Build a DFA for strings containing '011'",
  'Thompson construction for (a|b)*abb',
  'something the parser cannot handle',

  // New: minimization, equivalence, conversion
  'Minimize the DFA for strings ending in 01',
  'NFA to DFA for /(a|b)*abb/',
  'Convert DFA for length divisible by 3 to a regex via state elimination',
  'Apply Arden\'s theorem to DFA for binary strings divisible by 2',

  // Simulation
  'Simulate DFA on input 1101 for strings ending in 01',
  'Check whether 011 is accepted by DFA containing 011',

  // Mealy / Moore
  'Build a Mealy machine that detects 01 edges',
  'Construct a Moore machine that outputs |w| mod 3',
  'Convert Mealy to Moore for edge detector',

  // CFG
  'Convert to CNF:\nS -> aSb | ε\nA -> a',
  'Simplify grammar:\nS -> AB | a\nA -> b\nB -> AB',
  'Greibach normal form:\nS -> aS | b',

  // FIRST/FOLLOW & LL(1)
  'FIRST and FOLLOW for:\nE -> T E\'\nE\' -> + T E\' | ε\nT -> F T\'\nT\' -> * F T\' | ε\nF -> ( E ) | i',
  'LL(1) parse table for:\nS -> aB | b\nB -> b',

  // Parse tree
  'Parse tree for input aabb with grammar:\nS -> aSb | ε',

  // PDA / TM
  'PDA for a^n b^n',
  'PDA for palindromes',
  'Turing machine for a^n b^n c^n on input aabbcc',
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const r = solveAutomataQuestion(c);
  const oneLineQ = c.replace(/\s+/g, ' ').slice(0, 60);
  if (r.success) {
    pass++;
    console.log(`OK   | ${oneLineQ}`);
    console.log(`     summary: ${r.summary.slice(0, 100)}…`);
    console.log(`     strokes: ${r.strokes.length}, paper: ${r.paper.size} ${r.paper.orientation}`);
  } else {
    fail++;
    console.log(`NO   | ${oneLineQ}`);
    console.log(`     refusal: ${r.refusalReason?.slice(0, 150)}`);
  }
  console.log();
}
console.log(`Pass: ${pass}, refuse: ${fail}, total: ${cases.length}`);
