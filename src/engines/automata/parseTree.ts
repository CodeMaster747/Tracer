import type { Grammar, ParseTreeNode, Production } from './types';
import { firstSets, firstOfSequence, buildLL1Table } from './ll1';

/**
 * Build a parse tree for a string `input` under grammar `g` using a top-down
 * LL(1) algorithm when possible; otherwise fall back to a brute-force depth-
 * limited search.
 *
 * Returns the parse tree root and a derivation step list, or `null` if no
 * derivation can be found within the depth limit.
 */
export function deriveParseTree(
  g: Grammar,
  input: string,
  depthLimit = 20
): { root: ParseTreeNode; derivation: string[] } | null {
  // Try LL(1) first
  const ll1 = buildLL1Table(g);
  if (ll1.isLL1) {
    const tokens = [...input, '$'];
    const root: ParseTreeNode = { label: g.start, children: [] };
    type Frame = { sym: string; node: ParseTreeNode };
    const stack: Frame[] = [
      { sym: '$', node: { label: '$', isTerminal: true, children: [] } },
      { sym: g.start, node: root },
    ];
    let cursor = 0;
    const deriv: string[] = [g.start];
    while (stack.length) {
      const top = stack.pop()!;
      const cur = tokens[cursor];
      if (top.sym === '$' && cur === '$') {
        return { root, derivation: deriv };
      }
      if (!g.nonterminals.has(top.sym)) {
        if (top.sym !== cur) return null;
        cursor++;
        top.node.isTerminal = true;
        continue;
      }
      const prod = ll1.table.get(top.sym)?.get(cur);
      if (!prod || prod.length === 0) return null;
      const rhs = prod[0];
      // ε production: attach an ε leaf and continue without pushing
      if (rhs.length === 0 || (rhs.length === 1 && rhs[0] === 'ε')) {
        top.node.children = [{ label: 'ε', isTerminal: true, children: [] }];
        deriv.push(`apply ${top.sym} → ε`);
        continue;
      }
      const newChildren: ParseTreeNode[] = [];
      for (const sym of rhs) {
        newChildren.push({ label: sym, children: [] });
      }
      top.node.children = newChildren;
      for (let i = rhs.length - 1; i >= 0; i--) {
        stack.push({ sym: rhs[i], node: newChildren[i] });
      }
      deriv.push(`apply ${top.sym} → ${rhs.join('')}`);
    }
    return null;
  }

  // Fallback: depth-limited leftmost-derivation search
  const first = firstSets(g);
  const tokens = [...input];

  type DFS = { sentential: string[]; tree: ParseTreeNode; pos: number; depth: number; deriv: string[] };

  const seed: DFS = {
    sentential: [g.start],
    tree: { label: g.start, children: [] },
    pos: 0,
    depth: 0,
    deriv: [g.start],
  };
  const stack: DFS[] = [seed];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.depth > depthLimit) continue;
    // Find leftmost non-terminal
    const i = cur.sentential.findIndex((s) => g.nonterminals.has(s));
    if (i < 0) {
      // No NT left — does string match?
      const lit = cur.sentential.filter((s) => s !== 'ε');
      if (lit.length === tokens.length && lit.every((c, k) => c === tokens[k])) {
        return { root: cur.tree, derivation: cur.deriv };
      }
      continue;
    }
    // Pruning: check that the literal prefix matches
    const prefix = cur.sentential.slice(0, i).filter((s) => s !== 'ε');
    if (prefix.length > tokens.length) continue;
    if (!prefix.every((c, k) => c === tokens[k])) continue;

    // For each production of cur.sentential[i], substitute and recurse
    const sym = cur.sentential[i];
    const treeNode = findFirstNonexpanded(cur.tree, sym);
    if (!treeNode) continue;
    for (const p of g.productions.filter((q) => q.lhs === sym)) {
      const newSent = [
        ...cur.sentential.slice(0, i),
        ...p.rhs.filter((s) => s !== 'ε'),
        ...cur.sentential.slice(i + 1),
      ];
      // Quick check: FIRST(newSent[i:]) should include tokens[i] or include ε
      const rest = newSent.slice(i);
      const fs = firstOfSequence(rest, first);
      const expected = tokens[i];
      if (
        expected !== undefined &&
        !fs.has(expected) &&
        !fs.has('ε') &&
        !(rest.length > 0 && rest[0] === expected)
      ) {
        continue;
      }
      // Clone tree & expand node
      const newTree = cloneTree(cur.tree);
      const clonedTarget = findFirstNonexpanded(newTree, sym);
      if (!clonedTarget) continue;
      clonedTarget.children = (p.rhs.length === 1 && p.rhs[0] === 'ε' ? [] : p.rhs).map(
        (s) => ({ label: s, children: [], isTerminal: !g.nonterminals.has(s) })
      );
      stack.push({
        sentential: newSent,
        tree: newTree,
        pos: cur.pos,
        depth: cur.depth + 1,
        deriv: [...cur.deriv, formatStep(p)],
      });
    }
  }
  return null;
}

function findFirstNonexpanded(node: ParseTreeNode, label: string): ParseTreeNode | null {
  if (node.label === label && node.children.length === 0) return node;
  for (const c of node.children) {
    const r = findFirstNonexpanded(c, label);
    if (r) return r;
  }
  return null;
}

function cloneTree(node: ParseTreeNode): ParseTreeNode {
  return {
    label: node.label,
    isTerminal: node.isTerminal,
    children: node.children.map(cloneTree),
  };
}

function formatStep(p: Production): string {
  return `${p.lhs} → ${p.rhs.length === 0 || (p.rhs.length === 1 && p.rhs[0] === 'ε') ? 'ε' : p.rhs.join('')}`;
}

/**
 * Compute layout coordinates for a parse tree using a simple width-aware
 * approach (Reingold–Tilford lite): assign each leaf a unit width, then place
 * each internal node at the centroid of its children.
 */
export interface TreeLayout {
  positions: Map<ParseTreeNode, { x: number; y: number }>;
  width: number;
  height: number;
}

export function layoutTree(
  root: ParseTreeNode,
  opts: { xUnit?: number; yUnit?: number } = {}
): TreeLayout {
  const xUnit = opts.xUnit ?? 18;
  const yUnit = opts.yUnit ?? 20;
  const positions = new Map<ParseTreeNode, { x: number; y: number }>();
  let nextX = 0;

  const place = (node: ParseTreeNode, depth: number) => {
    if (node.children.length === 0) {
      positions.set(node, { x: nextX * xUnit, y: depth * yUnit });
      nextX++;
      return;
    }
    for (const c of node.children) place(c, depth + 1);
    const xs = node.children.map((c) => positions.get(c)!.x);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    positions.set(node, { x: cx, y: depth * yUnit });
  };
  place(root, 0);

  const allX = [...positions.values()].map((p) => p.x);
  const allY = [...positions.values()].map((p) => p.y);
  return {
    positions,
    width: Math.max(...allX) - Math.min(...allX),
    height: Math.max(...allY) - Math.min(...allY),
  };
}
