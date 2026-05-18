import type { Grammar } from './types';

/**
 * FIRST sets, FOLLOW sets, and LL(1) parsing tables.
 */

export interface LL1Result {
  first: Map<string, Set<string>>;
  follow: Map<string, Set<string>>;
  table: Map<string, Map<string, string[][]>>;
  conflicts: string[];
  isLL1: boolean;
  terminals: string[];
}

const EPS = 'ε';
const EOI = '$';

export function firstSets(g: Grammar): Map<string, Set<string>> {
  const first = new Map<string, Set<string>>();
  for (const A of g.nonterminals) first.set(A, new Set());
  for (const t of g.terminals) first.set(t, new Set([t]));
  first.set(EPS, new Set([EPS]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      const f = first.get(p.lhs)!;
      const sizeBefore = f.size;
      if (p.rhs.length === 0 || (p.rhs.length === 1 && p.rhs[0] === EPS)) {
        f.add(EPS);
      } else {
        let i = 0;
        while (i < p.rhs.length) {
          const s = p.rhs[i];
          const fs = first.get(s) ?? new Set([s]);
          for (const x of fs) if (x !== EPS) f.add(x);
          if (!fs.has(EPS)) break;
          i++;
        }
        if (i === p.rhs.length) f.add(EPS);
      }
      if (f.size > sizeBefore) changed = true;
    }
  }
  return first;
}

/**
 * FIRST of a sequence of symbols.
 */
export function firstOfSequence(
  seq: string[],
  first: Map<string, Set<string>>
): Set<string> {
  const out = new Set<string>();
  if (seq.length === 0 || (seq.length === 1 && seq[0] === EPS)) {
    out.add(EPS);
    return out;
  }
  let i = 0;
  while (i < seq.length) {
    const fs = first.get(seq[i]) ?? new Set([seq[i]]);
    for (const x of fs) if (x !== EPS) out.add(x);
    if (!fs.has(EPS)) return out;
    i++;
  }
  out.add(EPS);
  return out;
}

export function followSets(
  g: Grammar,
  first: Map<string, Set<string>>
): Map<string, Set<string>> {
  const follow = new Map<string, Set<string>>();
  for (const A of g.nonterminals) follow.set(A, new Set());
  follow.get(g.start)!.add(EOI);

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.productions) {
      for (let i = 0; i < p.rhs.length; i++) {
        const B = p.rhs[i];
        if (!g.nonterminals.has(B)) continue;
        const beta = p.rhs.slice(i + 1);
        const fb = firstOfSequence(beta, first);
        const before = follow.get(B)!.size;
        for (const t of fb) if (t !== EPS) follow.get(B)!.add(t);
        if (fb.has(EPS) || beta.length === 0) {
          for (const t of follow.get(p.lhs) ?? []) follow.get(B)!.add(t);
        }
        if (follow.get(B)!.size > before) changed = true;
      }
    }
  }
  return follow;
}

export function buildLL1Table(g: Grammar): LL1Result {
  const first = firstSets(g);
  const follow = followSets(g, first);
  const table = new Map<string, Map<string, string[][]>>();
  const conflicts: string[] = [];
  const terminals = [...g.terminals, EOI];
  for (const A of g.nonterminals) table.set(A, new Map());

  for (const p of g.productions) {
    const fs = firstOfSequence(p.rhs, first);
    for (const a of fs) {
      if (a === EPS) continue;
      const row = table.get(p.lhs)!;
      const existing = row.get(a) ?? [];
      if (existing.length > 0) {
        conflicts.push(`Conflict at M[${p.lhs}, ${a}]: ${p.lhs} → ${formatRhs(p.rhs)} and ${p.lhs} → ${formatRhs(existing[0])}`);
      }
      existing.push(p.rhs);
      row.set(a, existing);
    }
    if (fs.has(EPS)) {
      for (const b of follow.get(p.lhs) ?? []) {
        const row = table.get(p.lhs)!;
        const existing = row.get(b) ?? [];
        if (existing.length > 0) {
          conflicts.push(`Conflict at M[${p.lhs}, ${b}]: ${p.lhs} → ${formatRhs(p.rhs)} and ${p.lhs} → ${formatRhs(existing[0])}`);
        }
        existing.push(p.rhs);
        row.set(b, existing);
      }
    }
  }

  return {
    first,
    follow,
    table,
    conflicts,
    isLL1: conflicts.length === 0,
    terminals,
  };
}

function formatRhs(rhs: string[]): string {
  if (rhs.length === 0) return EPS;
  return rhs.join('');
}

export function ll1TableToTable(g: Grammar, r: LL1Result): {
  headers: string[];
  rows: string[][];
} {
  const headers = ['', ...r.terminals];
  const rows: string[][] = [];
  for (const A of g.nonterminals) {
    const row: string[] = [A];
    for (const a of r.terminals) {
      const cell = r.table.get(A)?.get(a);
      if (!cell || cell.length === 0) row.push('—');
      else row.push(cell.map((rhs) => `${A}→${formatRhs(rhs)}`).join(' / '));
    }
    rows.push(row);
  }
  return { headers, rows };
}

export function firstFollowToTable(g: Grammar, r: LL1Result): {
  headers: string[];
  rows: string[][];
} {
  const headers = ['Non-terminal', 'FIRST', 'FOLLOW'];
  const rows: string[][] = [];
  for (const A of g.nonterminals) {
    rows.push([
      A,
      `{${[...(r.first.get(A) ?? [])].sort().join(', ')}}`,
      `{${[...(r.follow.get(A) ?? [])].sort().join(', ')}}`,
    ]);
  }
  return { headers, rows };
}
