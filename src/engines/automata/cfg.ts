import type { Grammar, Production } from './types';

/**
 * Parse a textual grammar.
 *
 * Accepted format (one production per line, '|' for alternates):
 *   S -> a S b | ε
 *   A -> A a | b
 *
 * Conventions:
 *   - Uppercase identifiers are non-terminals (single char), unless an explicit
 *     nonterminals list is given via "Nonterminals: A,B,S".
 *   - Lowercase letters and digits, and any single non-uppercase character that
 *     is not |, ->, or whitespace, are terminals.
 *   - ε, eps, e, or an empty rhs denotes the empty string.
 *   - The first non-terminal that appears as an LHS is the start symbol unless
 *     specified with "Start: S".
 */
export function parseGrammar(src: string): Grammar {
  const lines = src
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  let start: string | null = null;
  const productions: Production[] = [];
  const ntSet = new Set<string>();
  const tSet = new Set<string>();
  let explicitNT: Set<string> | null = null;

  for (const line of lines) {
    if (/^start\s*[:=]/i.test(line)) {
      start = line.split(/[:=]/)[1].trim();
      continue;
    }
    if (/^non[- ]?terminals?\s*[:=]/i.test(line)) {
      explicitNT = new Set(
        line
          .split(/[:=]/)[1]
          .split(/[,\s]+/)
          .filter(Boolean)
      );
      continue;
    }
    if (/^terminals?\s*[:=]/i.test(line)) continue;

    // Production:  LHS -> RHS | RHS ...
    const arrowMatch = line.match(/^([^->]+?)\s*(?:->|→|::=|=)\s*(.*)$/);
    if (!arrowMatch) continue;
    const lhs = arrowMatch[1].trim();
    const rhsAll = arrowMatch[2];
    const alternates = rhsAll.split('|').map((a) => a.trim());
    ntSet.add(lhs);
    if (!start) start = lhs;
    for (const alt of alternates) {
      const symbols = tokenizeRhs(alt);
      productions.push({ lhs, rhs: symbols });
    }
  }

  // Determine final NT/T sets
  const nonterminals = explicitNT ?? ntSet;
  for (const p of productions) {
    for (const s of p.rhs) {
      if (s === 'ε' || s === '') continue;
      if (!nonterminals.has(s)) tSet.add(s);
    }
  }

  if (!start) start = [...nonterminals][0] ?? 'S';
  return { nonterminals: new Set(nonterminals), terminals: tSet, start, productions };
}

function tokenizeRhs(rhs: string): string[] {
  const t = rhs.trim();
  if (t === '' || /^(ε|eps|e|epsilon)$/i.test(t)) return ['ε'];
  // Symbols may be space-separated or run together (single chars)
  if (/\s/.test(t)) return t.split(/\s+/).filter(Boolean);
  return [...t];
}

export function formatProduction(p: Production): string {
  const rhs = p.rhs.length === 0 || (p.rhs.length === 1 && p.rhs[0] === 'ε') ? 'ε' : p.rhs.join('');
  return `${p.lhs} → ${rhs}`;
}

export function formatGrammar(g: Grammar): string[] {
  // Group by lhs
  const byLhs = new Map<string, string[][]>();
  for (const p of g.productions) {
    const rhs = p.rhs.length === 0 ? ['ε'] : p.rhs;
    if (!byLhs.has(p.lhs)) byLhs.set(p.lhs, []);
    byLhs.get(p.lhs)!.push(rhs);
  }
  const lines: string[] = [];
  // Start first
  const lhsOrder = [g.start, ...[...byLhs.keys()].filter((k) => k !== g.start)];
  for (const lhs of lhsOrder) {
    const rhss = byLhs.get(lhs);
    if (!rhss) continue;
    const rhsTxt = rhss.map((r) => r.join('')).join(' | ');
    lines.push(`${lhs} → ${rhsTxt}`);
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Simplification                                                      */
/* ------------------------------------------------------------------ */

/**
 * Compute the set of nullable non-terminals (those deriving ε).
 */
export function nullableSet(g: Grammar): Set<string> {
  const nullable = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      if (nullable.has(p.lhs)) continue;
      if (p.rhs.length === 0 || (p.rhs.length === 1 && p.rhs[0] === 'ε')) {
        nullable.add(p.lhs);
        changed = true;
        continue;
      }
      if (p.rhs.every((s) => g.nonterminals.has(s) && nullable.has(s))) {
        nullable.add(p.lhs);
        changed = true;
      }
    }
  }
  return nullable;
}

/**
 * Remove ε-productions (other than from the start symbol, if needed).
 */
export function removeEpsilon(g: Grammar): { grammar: Grammar; trace: string[] } {
  const nullable = nullableSet(g);
  const trace: string[] = [`Nullable set: {${[...nullable].join(', ')}}`];

  const out: Production[] = [];
  for (const p of g.productions) {
    if (p.rhs.length === 0 || (p.rhs.length === 1 && p.rhs[0] === 'ε')) continue;
    // For every subset of nullable positions in rhs, add a variant with those removed.
    const positions = p.rhs
      .map((s, i) => (nullable.has(s) ? i : -1))
      .filter((i) => i >= 0);
    const m = positions.length;
    const seen = new Set<string>();
    for (let mask = 0; mask < 1 << m; mask++) {
      const rhs: string[] = [];
      for (let i = 0; i < p.rhs.length; i++) {
        const idx = positions.indexOf(i);
        if (idx >= 0 && (mask >> idx) & 1) continue;
        rhs.push(p.rhs[i]);
      }
      if (rhs.length === 0) continue; // skip pure ε
      const key = rhs.join('\0');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ lhs: p.lhs, rhs });
    }
  }

  // If start is nullable, allow S' → ε via new start
  let start = g.start;
  const nonterminals = new Set(g.nonterminals);
  if (nullable.has(g.start)) {
    const sPrime = freshName(nonterminals, `${g.start}'`);
    nonterminals.add(sPrime);
    out.unshift({ lhs: sPrime, rhs: [g.start] });
    out.push({ lhs: sPrime, rhs: ['ε'] });
    start = sPrime;
    trace.push(`Start ${g.start} is nullable; introduced new start ${sPrime} with ${sPrime} → ${g.start} | ε.`);
  }

  return {
    grammar: { nonterminals, terminals: g.terminals, start, productions: out },
    trace,
  };
}

function freshName(used: Set<string>, base: string): string {
  if (!used.has(base)) return base;
  let i = 1;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

/**
 * Remove unit productions A → B.
 */
export function removeUnit(g: Grammar): { grammar: Grammar; trace: string[] } {
  const trace: string[] = [];
  const unitPairs = new Map<string, Set<string>>();
  for (const A of g.nonterminals) unitPairs.set(A, new Set([A]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      if (p.rhs.length === 1 && g.nonterminals.has(p.rhs[0])) {
        const A = p.lhs;
        const B = p.rhs[0];
        for (const C of unitPairs.get(B) ?? []) {
          if (!unitPairs.get(A)!.has(C)) {
            unitPairs.get(A)!.add(C);
            changed = true;
          }
        }
      }
    }
  }
  trace.push(`Unit-pair closure computed.`);
  const out: Production[] = [];
  for (const A of g.nonterminals) {
    for (const B of unitPairs.get(A) ?? []) {
      for (const p of g.productions) {
        if (p.lhs !== B) continue;
        if (p.rhs.length === 1 && g.nonterminals.has(p.rhs[0])) continue; // skip unit
        out.push({ lhs: A, rhs: p.rhs });
      }
    }
  }
  return {
    grammar: { ...g, productions: dedupe(out) },
    trace,
  };
}

function dedupe(prods: Production[]): Production[] {
  const seen = new Set<string>();
  const out: Production[] = [];
  for (const p of prods) {
    const key = `${p.lhs}\0${p.rhs.join('\0')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Remove useless productions:
 *  - generating: those that can derive a terminal string
 *  - reachable: those reachable from start
 */
export function removeUseless(g: Grammar): { grammar: Grammar; trace: string[] } {
  const trace: string[] = [];

  // Generating
  const generating = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      if (generating.has(p.lhs)) continue;
      if (
        p.rhs.every((s) => !g.nonterminals.has(s) || s === 'ε' || generating.has(s))
      ) {
        generating.add(p.lhs);
        changed = true;
      }
    }
  }
  trace.push(`Generating non-terminals: {${[...generating].join(', ')}}`);

  let prods = g.productions.filter(
    (p) =>
      generating.has(p.lhs) &&
      p.rhs.every((s) => !g.nonterminals.has(s) || generating.has(s))
  );
  let nts = new Set([...generating]);

  // Reachable
  const reachable = new Set<string>([g.start]);
  changed = true;
  while (changed) {
    changed = false;
    for (const p of prods) {
      if (!reachable.has(p.lhs)) continue;
      for (const s of p.rhs) {
        if (nts.has(s) && !reachable.has(s)) {
          reachable.add(s);
          changed = true;
        }
      }
    }
  }
  trace.push(`Reachable non-terminals: {${[...reachable].join(', ')}}`);
  prods = prods.filter((p) => reachable.has(p.lhs));
  nts = new Set([...reachable]);

  return {
    grammar: {
      nonterminals: nts,
      terminals: g.terminals,
      start: g.start,
      productions: prods,
    },
    trace,
  };
}

/**
 * Full CFG simplification: remove ε, remove unit, remove useless.
 */
export function simplifyGrammar(g: Grammar): { grammar: Grammar; trace: string[] } {
  const trace: string[] = [];
  trace.push('— Remove ε-productions —');
  const a = removeEpsilon(g);
  trace.push(...a.trace);
  trace.push('— Remove unit productions —');
  const b = removeUnit(a.grammar);
  trace.push(...b.trace);
  trace.push('— Remove useless symbols —');
  const c = removeUseless(b.grammar);
  trace.push(...c.trace);
  return { grammar: c.grammar, trace };
}

/* ------------------------------------------------------------------ */
/* Chomsky Normal Form                                                 */
/* ------------------------------------------------------------------ */

/**
 * Convert a CFG to Chomsky Normal Form.
 * Every production becomes A → BC or A → a (or S → ε if the language contains ε).
 */
export function toCNF(input: Grammar): { grammar: Grammar; trace: string[] } {
  const trace: string[] = [];
  trace.push('Step 0 — Simplify (remove ε, unit, useless).');
  const simplified = simplifyGrammar(input);
  trace.push(...simplified.trace);
  let g = simplified.grammar;

  // Step 1: Introduce a "shadow" non-terminal for each terminal that appears
  // in any rhs of length ≥ 2.
  trace.push('Step 1 — Replace terminals in long RHS with fresh non-terminals.');
  const shadow = new Map<string, string>();
  const newProds: Production[] = [];
  const nts = new Set(g.nonterminals);
  for (const p of g.productions) {
    if (p.rhs.length >= 2) {
      const newRhs = p.rhs.map((s) => {
        if (g.nonterminals.has(s)) return s;
        if (!shadow.has(s)) shadow.set(s, freshName(nts, `T_${s}`));
        const nm = shadow.get(s)!;
        nts.add(nm);
        return nm;
      });
      newProds.push({ lhs: p.lhs, rhs: newRhs });
    } else {
      newProds.push(p);
    }
  }
  for (const [t, nm] of shadow) {
    newProds.push({ lhs: nm, rhs: [t] });
    trace.push(`  ${nm} → ${t}`);
  }
  g = { ...g, productions: newProds, nonterminals: nts };

  // Step 2: Break rules with length > 2 by introducing fresh non-terminals.
  trace.push('Step 2 — Break long RHS into binary.');
  const finalProds: Production[] = [];
  for (const p of g.productions) {
    if (p.rhs.length <= 2) {
      finalProds.push(p);
      continue;
    }
    let prev = p.lhs;
    for (let i = 0; i < p.rhs.length - 2; i++) {
      const helper = freshName(nts, `${p.lhs}_${i + 1}`);
      nts.add(helper);
      finalProds.push({ lhs: prev, rhs: [p.rhs[i], helper] });
      prev = helper;
    }
    finalProds.push({
      lhs: prev,
      rhs: [p.rhs[p.rhs.length - 2], p.rhs[p.rhs.length - 1]],
    });
  }
  g = { ...g, productions: dedupe(finalProds), nonterminals: nts };
  trace.push(`Final CNF productions: ${g.productions.length}.`);
  return { grammar: g, trace };
}

/* ------------------------------------------------------------------ */
/* Greibach Normal Form (sketch)                                       */
/* ------------------------------------------------------------------ */

/**
 * Best-effort conversion to Greibach Normal Form.
 *
 * Strategy:
 *  1. CNF first.
 *  2. Order non-terminals A1, A2, …, An.
 *  3. For each i = 1..n: for each j < i with rules Ai → Aj γ, substitute Aj.
 *     Then eliminate immediate left recursion in Ai.
 *  4. Back-substitute so every rhs starts with a terminal.
 *
 * Note: For general grammars GNF conversion may produce a large grammar; we
 * cap iterations and return a partial result with a note if non-convergent.
 */
export function toGNF(input: Grammar): { grammar: Grammar; trace: string[] } {
  const trace: string[] = [];
  const cnf = toCNF(input);
  trace.push('Step 0 — Convert to CNF first.');
  trace.push(...cnf.trace);
  const g = cnf.grammar;

  const order = [g.start, ...[...g.nonterminals].filter((n) => n !== g.start)];
  const nts = new Set(g.nonterminals);

  trace.push(`Non-terminal order: ${order.join(' < ')}`);

  let productions = [...g.productions];

  const rulesOf = (A: string) => productions.filter((p) => p.lhs === A);

  for (let i = 0; i < order.length; i++) {
    const Ai = order[i];
    // For j < i, substitute Aj at the start of any Ai rule
    for (let j = 0; j < i; j++) {
      const Aj = order[j];
      const newProds: Production[] = [];
      for (const p of productions) {
        if (p.lhs === Ai && p.rhs[0] === Aj) {
          for (const r of rulesOf(Aj)) {
            newProds.push({ lhs: Ai, rhs: [...r.rhs, ...p.rhs.slice(1)] });
          }
        } else {
          newProds.push(p);
        }
      }
      productions = newProds;
    }
    // Eliminate immediate left recursion on Ai
    const direct = productions.filter((p) => p.lhs === Ai && p.rhs[0] === Ai);
    if (direct.length === 0) continue;
    const other = productions.filter((p) => p.lhs === Ai && p.rhs[0] !== Ai);
    if (other.length === 0) {
      trace.push(`Warning: ${Ai} has only left-recursive rules; GNF not possible.`);
      continue;
    }
    const Bi = freshName(nts, `${Ai}'`);
    nts.add(Bi);
    const newProds: Production[] = productions.filter((p) => p.lhs !== Ai);
    for (const p of other) {
      newProds.push({ lhs: Ai, rhs: p.rhs });
      newProds.push({ lhs: Ai, rhs: [...p.rhs, Bi] });
    }
    for (const p of direct) {
      newProds.push({ lhs: Bi, rhs: p.rhs.slice(1) });
      newProds.push({ lhs: Bi, rhs: [...p.rhs.slice(1), Bi] });
    }
    productions = newProds;
    trace.push(`Removed left recursion on ${Ai} (added ${Bi}).`);
  }

  // Back-substitute so every rhs begins with a terminal
  let iter = 0;
  let changed = true;
  while (changed && iter < 50) {
    changed = false;
    iter++;
    const newProds: Production[] = [];
    for (const p of productions) {
      if (p.rhs.length === 0) {
        newProds.push(p);
        continue;
      }
      const head = p.rhs[0];
      if (nts.has(head)) {
        const subs = productions.filter((r) => r.lhs === head);
        if (subs.length === 0) {
          newProds.push(p);
          continue;
        }
        for (const r of subs) {
          newProds.push({ lhs: p.lhs, rhs: [...r.rhs, ...p.rhs.slice(1)] });
        }
        changed = true;
      } else {
        newProds.push(p);
      }
    }
    productions = dedupe(newProds);
  }
  if (changed) trace.push('Note: GNF back-substitution did not fully converge; result may be partial.');

  return {
    grammar: {
      nonterminals: nts,
      terminals: g.terminals,
      start: g.start,
      productions: dedupe(productions),
    },
    trace,
  };
}
