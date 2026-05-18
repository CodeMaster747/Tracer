/**
 * Signal-flow graph (SFG) analysis via Mason's Gain Formula.
 *
 *   T  = (1 / Δ) Σ Pₖ Δₖ
 *
 * where:
 *   Pₖ      = forward-path gain
 *   Δ       = 1 - Σ Li + Σ Li·Lj (non-touching pairs) - Σ Li·Lj·Lk (non-touching triples) + …
 *   Δₖ      = Δ evaluated removing all loops that touch Pₖ
 *
 * The graph is described as a list of branches:  from --gain--> to
 * Numeric gains are evaluated; the result is also produced as a symbolic expression.
 */

import type { SignalFlowGraph, MasonResult, SFGBranch } from './controlTypes';

export interface SFGSpec {
  branches: SFGBranch[];
  input: string;
  output: string;
}

/* ---------- Path enumeration ---------- */

function enumerateForwardPaths(spec: SFGSpec): { nodes: string[]; gains: string[] }[] {
  const adj = new Map<string, { to: string; gain: string }[]>();
  for (const b of spec.branches) {
    let l = adj.get(b.from);
    if (!l) { l = []; adj.set(b.from, l); }
    l.push({ to: b.to, gain: b.gain });
  }
  const paths: { nodes: string[]; gains: string[] }[] = [];
  const visited = new Set<string>();
  function dfs(node: string, accNodes: string[], accGains: string[]) {
    if (node === spec.output) { paths.push({ nodes: [...accNodes], gains: [...accGains] }); return; }
    const outs = adj.get(node) ?? [];
    for (const e of outs) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      accNodes.push(e.to);
      accGains.push(e.gain);
      dfs(e.to, accNodes, accGains);
      accNodes.pop();
      accGains.pop();
      visited.delete(e.to);
    }
  }
  visited.add(spec.input);
  dfs(spec.input, [spec.input], []);
  return paths;
}

/* ---------- Loop enumeration via Johnson-like simple-cycle search ---------- */

function enumerateLoops(spec: SFGSpec): { nodes: string[]; gains: string[] }[] {
  const adj = new Map<string, { to: string; gain: string }[]>();
  for (const b of spec.branches) {
    let l = adj.get(b.from);
    if (!l) { l = []; adj.set(b.from, l); }
    l.push({ to: b.to, gain: b.gain });
  }
  const allNodes = new Set<string>();
  spec.branches.forEach((b) => { allNodes.add(b.from); allNodes.add(b.to); });
  const nodes = [...allNodes];
  const cycles: { nodes: string[]; gains: string[] }[] = [];

  for (const start of nodes) {
    const visited = new Set<string>();
    function dfs(node: string, accNodes: string[], accGains: string[]) {
      const outs = adj.get(node) ?? [];
      for (const e of outs) {
        if (e.to === start && accNodes.length >= 1) {
          // closed a simple cycle
          const cyc = { nodes: [...accNodes, start], gains: [...accGains, e.gain] };
          // canonicalize: shift so smallest node comes first
          const minIdx = cyc.nodes.slice(0, -1).reduce((m, v, i, a) => (v < a[m] ? i : m), 0);
          const rotated = cyc.nodes.slice(minIdx, -1).concat(cyc.nodes.slice(0, minIdx)).concat(cyc.nodes[minIdx]);
          const rotGains = cyc.gains.slice(minIdx).concat(cyc.gains.slice(0, minIdx));
          // dedupe: skip if any existing cycle has same canonical nodes sequence
          const key = rotated.join('->');
          if (!cycles.some((c) => c.nodes.join('->') === key)) {
            cycles.push({ nodes: rotated, gains: rotGains });
          }
          continue;
        }
        if (visited.has(e.to) || e.to < start) continue;
        visited.add(e.to);
        accNodes.push(e.to);
        accGains.push(e.gain);
        dfs(e.to, accNodes, accGains);
        visited.delete(e.to);
        accNodes.pop();
        accGains.pop();
      }
    }
    visited.add(start);
    dfs(start, [start], []);
  }
  return cycles;
}

/* ---------- Non-touching set construction ---------- */

function loopsTouch(loopA: string[], loopB: string[]): boolean {
  const setB = new Set(loopB);
  for (const n of loopA) if (setB.has(n)) return true;
  return false;
}

/* ---------- Numeric evaluator for symbolic gain strings ---------- */

function evalGain(expr: string, env: Record<string, number>): number {
  // Replace identifiers with numeric values
  const replaced = expr.replace(/[A-Za-z_]\w*/g, (id) => {
    if (id in env) return `(${env[id]})`;
    const num = Number(id);
    if (!Number.isNaN(num)) return id;
    throw new Error(`Unknown gain identifier: ${id}`);
  });
  // Safe arithmetic eval (allowed chars only)
  if (!/^[\d+\-*/().\s]+$/.test(replaced)) throw new Error('Invalid gain expression');
   
  const val = Function(`"use strict"; return (${replaced});`)();
  return Number(val);
}

/* ---------- Mason's formula ---------- */

export function masonsGain(spec: SFGSpec, env: Record<string, number> = {}): MasonResult {
  const paths = enumerateForwardPaths(spec);
  const loops = enumerateLoops(spec);

  // path gains
  const fwd = paths.map((p) => {
    const gain = p.gains.map((g) => `(${g})`).join('·');
    let gainValue = 1;
    try { for (const g of p.gains) gainValue *= evalGain(g, env); } catch { gainValue = NaN; }
    return { nodes: p.nodes, gain, gainValue };
  });
  const loopList = loops.map((l) => {
    const gain = l.gains.map((g) => `(${g})`).join('·');
    let gainValue = 1;
    try { for (const g of l.gains) gainValue *= evalGain(g, env); } catch { gainValue = NaN; }
    return { nodes: l.nodes, gain, gainValue };
  });

  // Non-touching combinations: enumerate up to all combinations
  const k = loopList.length;
  // build a touching matrix
  const T: boolean[][] = [];
  for (let i = 0; i < k; i++) {
    T.push([]);
    for (let j = 0; j < k; j++) T[i].push(loopsTouch(loopList[i].nodes.slice(0, -1), loopList[j].nodes.slice(0, -1)));
  }
  // recursive subset gen
  const nonTouchingSubsets: number[][][] = []; // nonTouchingSubsets[r] = list of index-subsets of size r
  for (let r = 0; r <= k; r++) nonTouchingSubsets.push([]);
  nonTouchingSubsets[0].push([]);
  function extend(subset: number[], start: number) {
    for (let i = start; i < k; i++) {
      let ok = true;
      for (const j of subset) if (T[i][j]) { ok = false; break; }
      if (!ok) continue;
      const next = [...subset, i];
      nonTouchingSubsets[next.length].push(next);
      extend(next, i + 1);
    }
  }
  extend([], 0);

  // Δ = 1 - Σ Li + Σ Li Lj - …
  const sumByR: { val: number; expr: string }[] = [];
  sumByR.push({ val: 0, expr: '' });
  for (let r = 1; r <= k; r++) {
    let val = 0;
    const exprParts: string[] = [];
    for (const subset of nonTouchingSubsets[r]) {
      let prod = 1;
      const parts: string[] = [];
      for (const idx of subset) {
        prod *= loopList[idx].gainValue;
        parts.push(`L${idx + 1}`);
      }
      val += prod;
      exprParts.push(parts.join('·'));
    }
    sumByR.push({ val, expr: exprParts.length ? exprParts.join(' + ') : '' });
  }
  let deltaVal = 1;
  const deltaParts: string[] = ['1'];
  for (let r = 1; r <= k; r++) {
    if (sumByR[r].val === 0 && sumByR[r].expr === '') continue;
    deltaVal += (r % 2 === 1 ? -1 : +1) * sumByR[r].val;
    deltaParts.push(`${r % 2 === 1 ? '-' : '+'} (${sumByR[r].expr})`);
  }
  const deltaExpr = deltaParts.join(' ');

  // Δk for each path: identify loops that DON'T touch path k → keep those loops only
  const pathNodeSets = paths.map((p) => new Set(p.nodes));
  const deltaKValues: number[] = [];
  const deltaKExprs: string[] = [];
  for (let pi = 0; pi < paths.length; pi++) {
    const keep: number[] = [];
    for (let i = 0; i < k; i++) {
      const touches = loopList[i].nodes.slice(0, -1).some((n) => pathNodeSets[pi].has(n));
      if (!touches) keep.push(i);
    }
    // build delta over only the kept loops
    const subT: boolean[][] = [];
    for (let i = 0; i < keep.length; i++) {
      subT.push([]);
      for (let j = 0; j < keep.length; j++) subT[i].push(T[keep[i]][keep[j]]);
    }
    const subSets: number[][][] = [];
    for (let r = 0; r <= keep.length; r++) subSets.push([]);
    subSets[0].push([]);
    (function build(sub: number[], start: number) {
      for (let i = start; i < keep.length; i++) {
        let ok = true;
        for (const j of sub) if (subT[i][j]) { ok = false; break; }
        if (!ok) continue;
        const next = [...sub, i];
        subSets[next.length].push(next);
        build(next, i + 1);
      }
    })([], 0);
    let dkVal = 1;
    const exprParts: string[] = ['1'];
    for (let r = 1; r <= keep.length; r++) {
      let sval = 0;
      const sparts: string[] = [];
      for (const subset of subSets[r]) {
        let prod = 1;
        const namedParts: string[] = [];
        for (const localIdx of subset) {
          prod *= loopList[keep[localIdx]].gainValue;
          namedParts.push(`L${keep[localIdx] + 1}`);
        }
        sval += prod;
        sparts.push(namedParts.join('·'));
      }
      if (sval === 0 && sparts.length === 0) continue;
      dkVal += (r % 2 === 1 ? -1 : +1) * sval;
      exprParts.push(`${r % 2 === 1 ? '-' : '+'} (${sparts.join(' + ')})`);
    }
    deltaKValues.push(dkVal);
    deltaKExprs.push(exprParts.join(' '));
  }

  let tfVal = 0;
  const tfParts: string[] = [];
  for (let i = 0; i < fwd.length; i++) {
    tfVal += (fwd[i].gainValue * deltaKValues[i]) / deltaVal;
    tfParts.push(`P${i + 1}·Δ${i + 1}`);
  }
  const tfExpr = `(${tfParts.join(' + ')}) / Δ`;

  // non-touching combos pretty string
  const nonTouchPretty: string[] = [];
  for (let r = 1; r <= k; r++) {
    for (const subset of nonTouchingSubsets[r]) {
      if (subset.length < 2) continue;
      nonTouchPretty.push(subset.map((i) => `L${i + 1}`).join(' & '));
    }
  }

  return {
    forwardPaths: fwd,
    loops: loopList,
    nonTouching: [nonTouchPretty],
    delta: deltaExpr,
    deltaValue: deltaVal,
    deltaK: deltaKExprs,
    deltaKValues,
    transferFunction: tfExpr,
    transferFunctionValue: tfVal,
  };
}

/* ---------- Convert spec → renderable graph view ---------- */

export function specToGraph(spec: SFGSpec): SignalFlowGraph {
  const nodesById = new Map<string, { id: string; label?: string }>();
  for (const b of spec.branches) {
    if (!nodesById.has(b.from)) nodesById.set(b.from, { id: b.from, label: b.from });
    if (!nodesById.has(b.to)) nodesById.set(b.to, { id: b.to, label: b.to });
  }
  return {
    nodes: [...nodesById.values()],
    branches: spec.branches.slice(),
    inputNode: spec.input,
    outputNode: spec.output,
  };
}

/* ---------- Parser for SFG text ---------- */

/**
 * Parse a list of branches given as `from -> to : gain` or `from -- gain --> to`.
 * Also accepts symbolic gains.  Trailing `input: X`, `output: Y` lines select endpoints.
 */
export function parseSFG(text: string): SFGSpec {
  const branches: SFGBranch[] = [];
  let input: string | undefined;
  let output: string | undefined;
  const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  for (const raw of lines) {
    const line = raw.replace(/\s*[,;]\s*$/, '');
    const inOut = line.match(/^(input|output)\s*[:=]\s*([A-Za-z]\w*)\s*$/i);
    if (inOut) {
      if (inOut[1].toLowerCase() === 'input') input = inOut[2];
      else output = inOut[2];
      continue;
    }
    const arrowGain = line.match(/^([A-Za-z]\w*)\s*--?\s*([^-]+?)\s*--?>\s*([A-Za-z]\w*)$/);
    if (arrowGain) {
      branches.push({ from: arrowGain[1], to: arrowGain[3], gain: arrowGain[2].trim() });
      continue;
    }
    const colonGain = line.match(/^([A-Za-z]\w*)\s*->\s*([A-Za-z]\w*)\s*[:=]\s*(.+)$/);
    if (colonGain) {
      branches.push({ from: colonGain[1], to: colonGain[2], gain: colonGain[3].trim() });
      continue;
    }
  }
  if (!input) input = branches[0]?.from ?? 'X1';
  if (!output) output = branches[branches.length - 1]?.to ?? 'Xn';
  return { branches, input, output };
}
