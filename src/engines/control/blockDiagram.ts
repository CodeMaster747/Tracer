/**
 * Block-diagram reduction for SISO loops.
 *
 * Recognises common topologies:
 *   - series:    G1 → G2 → … → Gk           ⇒  ∏Gi
 *   - parallel:  G1 + G2 + …                 ⇒  ΣGi
 *   - feedback:  G/(1±GH)                     (unity or non-unity)
 *   - nested feedbacks
 *
 * Accepts a textual description of the block diagram as a list of statements
 * (one per line). See `parseBlockDiagram` below.
 *
 * Returns a sequence of reduction steps + a final closed-loop transfer function.
 */
import type {
  BlockDiagram,
  DiagramBlock,
  DiagramEdge,
  BlockReductionResult,
  BlockReductionStep,
  TransferFunction,
} from './controlTypes';
import { parseTransferFunction } from './transferFunction';
import { polyMul } from './polynomial';
import type { Polynomial } from './polynomial';

/* ---------- Polynomial helpers ---------- */
function padTo(p: Polynomial, n: number): Polynomial {
  const out = p.slice();
  while (out.length < n) out.unshift(0);
  return out;
}
function polyAdd(a: Polynomial, b: Polynomial): Polynomial {
  const n = Math.max(a.length, b.length);
  const ap = padTo(a, n);
  const bp = padTo(b, n);
  return ap.map((v, i) => v + bp[i]);
}
function polySub(a: Polynomial, b: Polynomial): Polynomial {
  return polyAdd(a, b.map((v) => -v));
}
function simplifyTf(tf: TransferFunction): TransferFunction {
  const trimZero = (p: Polynomial): Polynomial => {
    let i = 0;
    while (i < p.length - 1 && Math.abs(p[i]) < 1e-12) i++;
    return p.slice(i);
  };
  return { numerator: trimZero(tf.numerator), denominator: trimZero(tf.denominator), display: tf.display };
}

/* ---------- Series ---------- */
export function series(...tfs: TransferFunction[]): TransferFunction {
  let num: Polynomial = [1];
  let den: Polynomial = [1];
  for (const tf of tfs) {
    num = polyMul(num, tf.numerator);
    den = polyMul(den, tf.denominator);
  }
  return simplifyTf({ numerator: num, denominator: den, display: tfs.map((t) => `(${t.display})`).join('·') });
}

/* ---------- Parallel ---------- */
export function parallel(...tfs: TransferFunction[]): TransferFunction {
  // (N1·D2·… + N2·D1·D3·… + …) / (D1·D2·…)
  let den: Polynomial = [1];
  for (const tf of tfs) den = polyMul(den, tf.denominator);
  let num: Polynomial = [0];
  for (let i = 0; i < tfs.length; i++) {
    let term: Polynomial = tfs[i].numerator.slice();
    for (let j = 0; j < tfs.length; j++) if (j !== i) term = polyMul(term, tfs[j].denominator);
    num = polyAdd(num, term);
  }
  return simplifyTf({ numerator: num, denominator: den, display: tfs.map((t) => `(${t.display})`).join('+') });
}

/* ---------- Feedback ---------- */
/**
 * Closed-loop transfer function with feedback H (default = 1, i.e. unity).
 *   GCL = G / (1 ± G·H)
 *      sign = '-' for negative feedback (default), '+' for positive.
 */
export function feedback(
  G: TransferFunction,
  H: TransferFunction = { numerator: [1], denominator: [1], display: '1' },
  sign: '-' | '+' = '-'
): TransferFunction {
  // GCL = (G_num · H_den) / (G_den · H_den ± G_num · H_num)
  const numCL = polyMul(G.numerator, H.denominator);
  const GH_num = polyMul(G.numerator, H.numerator);
  const den_prod = polyMul(G.denominator, H.denominator);
  const denCL = sign === '-' ? polyAdd(den_prod, GH_num) : polySub(den_prod, GH_num);
  return simplifyTf({
    numerator: numCL,
    denominator: denCL,
    display: `${G.display} / (1 ${sign} ${G.display}·${H.display})`,
  });
}

/* ---------- Textual block-diagram parser ---------- */

/**
 * Accepts a description like:
 *   G1 = 1/(s+1)
 *   G2 = 10/(s^2+2s+5)
 *   H  = 1
 *   forward: G1 → G2
 *   feedback: G1*G2 over H   (negative)
 *
 * Or shorthand single-line forms:
 *   "G1 in series with G2"
 *   "G1 in parallel with G2"
 *   "negative feedback G over H"
 *
 * Returns a {steps, final} reduction.
 */
export interface BlockSpec {
  blocks: Record<string, TransferFunction>;
  /** ordered list of ops to apply */
  ops: { kind: 'series' | 'parallel' | 'feedback'; args: string[]; sign?: '-' | '+'; H?: string }[];
}

export function parseBlockDiagramSpec(text: string): BlockSpec {
  const blocks: Record<string, TransferFunction> = {};
  const ops: BlockSpec['ops'] = [];
  const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    const assign = line.match(/^([A-Za-z]\w*)\s*=\s*(.+)$/);
    if (assign && !/series|parallel|feedback/i.test(line)) {
      blocks[assign[1]] = parseTransferFunction(assign[2]);
      continue;
    }
    const seriesM = line.match(/series\s*[:=]\s*(.+)$/i) ?? line.match(/^(.+)\s+in\s+series\s+with\s+(.+)$/i);
    if (seriesM) {
      const args = (seriesM[1] ?? '').split(/[,+→*x]\s*|\s+with\s+|\s*and\s*|\s*->\s*/).map((a) => a.trim()).filter(Boolean);
      const moreM = line.match(/^(.+)\s+in\s+series\s+with\s+(.+)$/i);
      if (moreM) ops.push({ kind: 'series', args: [moreM[1], moreM[2]] });
      else ops.push({ kind: 'series', args });
      continue;
    }
    const parM = line.match(/parallel\s*[:=]\s*(.+)$/i) ?? line.match(/^(.+)\s+in\s+parallel\s+with\s+(.+)$/i);
    if (parM) {
      const sg = line.match(/^(.+)\s+in\s+parallel\s+with\s+(.+)$/i);
      if (sg) ops.push({ kind: 'parallel', args: [sg[1], sg[2]] });
      else {
        const args = parM[1].split(/[,+]\s*/).map((a) => a.trim()).filter(Boolean);
        ops.push({ kind: 'parallel', args });
      }
      continue;
    }
    const fbM = line.match(/(?:(negative|positive)\s+)?feedback\s+(.+?)\s+over\s+(.+)$/i);
    if (fbM) {
      const sign = fbM[1]?.toLowerCase() === 'positive' ? '+' : '-';
      const forwardArgs = fbM[2].split(/[,*x]\s*|\s+/).map((s) => s.trim()).filter(Boolean);
      ops.push({ kind: 'feedback', args: forwardArgs, sign, H: fbM[3].trim() });
      continue;
    }
  }
  return { blocks, ops };
}

/* ---------- Apply reduction ops, producing step-by-step record ---------- */

export function reduceBlockDiagram(spec: BlockSpec): BlockReductionResult {
  const steps: BlockReductionStep[] = [];
  const defs = { ...spec.blocks };
  let last: TransferFunction | null = null;
  for (let i = 0; i < spec.ops.length; i++) {
    const op = spec.ops[i];
    const resolve = (name: string): TransferFunction => {
      const t = defs[name];
      if (!t) throw new Error(`Undefined block: ${name}`);
      return t;
    };
    let result: TransferFunction;
    if (op.kind === 'series') {
      const tfs = op.args.map(resolve);
      result = series(...tfs);
      steps.push({
        description: `Series combination of ${op.args.join(' · ')} → ${formatTf(result)}`,
        diagram: makeBlockDiagram(op.args, { kind: 'series' }),
      });
    } else if (op.kind === 'parallel') {
      const tfs = op.args.map(resolve);
      result = parallel(...tfs);
      steps.push({
        description: `Parallel combination of ${op.args.join(' + ')} → ${formatTf(result)}`,
        diagram: makeBlockDiagram(op.args, { kind: 'parallel' }),
      });
    } else {
      const G = op.args.length === 1 ? resolve(op.args[0]) : series(...op.args.map(resolve));
      const H = op.H ? resolve(op.H) : { numerator: [1], denominator: [1], display: '1' };
      result = feedback(G, H, op.sign ?? '-');
      steps.push({
        description: `${op.sign === '+' ? 'Positive' : 'Negative'} feedback (forward=${op.args.join(',')}, H=${op.H ?? '1'}) → ${formatTf(result)}`,
        diagram: makeBlockDiagram(op.args, { kind: 'feedback', H: op.H ?? '1', sign: op.sign ?? '-' }),
      });
    }
    last = result;
    defs[`STEP${i + 1}`] = result;
  }
  if (!last) throw new Error('No reduction ops provided');
  return { steps, final: last };
}

function makeBlockDiagram(names: string[], opts: { kind: 'series' | 'parallel' | 'feedback'; H?: string; sign?: '-' | '+' }): BlockDiagram {
  const blocks: DiagramBlock[] = [{ id: 'IN', kind: 'input', label: 'R(s)' }];
  const edges: DiagramEdge[] = [];
  if (opts.kind === 'series') {
    let prev = 'IN';
    names.forEach((n, i) => {
      blocks.push({ id: `B${i}`, kind: 'tf', label: n, expr: n });
      edges.push({ from: prev, to: `B${i}` });
      prev = `B${i}`;
    });
    blocks.push({ id: 'OUT', kind: 'output', label: 'C(s)' });
    edges.push({ from: prev, to: 'OUT' });
  } else if (opts.kind === 'parallel') {
    blocks.push({ id: 'SUM', kind: 'sum', signs: names.map(() => '+' as const) });
    names.forEach((n, i) => {
      blocks.push({ id: `B${i}`, kind: 'tf', label: n, expr: n });
      edges.push({ from: 'IN', to: `B${i}` });
      edges.push({ from: `B${i}`, to: 'SUM', toPort: i });
    });
    blocks.push({ id: 'OUT', kind: 'output', label: 'C(s)' });
    edges.push({ from: 'SUM', to: 'OUT' });
  } else {
    blocks.push({ id: 'SUM', kind: 'sum', signs: ['+', opts.sign === '+' ? '+' : '-'] });
    blocks.push({ id: 'FWD', kind: 'tf', label: names.join('·'), expr: names.join('·') });
    blocks.push({ id: 'H', kind: 'tf', label: opts.H, expr: opts.H });
    blocks.push({ id: 'OUT', kind: 'output', label: 'C(s)' });
    edges.push({ from: 'IN', to: 'SUM', toPort: 0 });
    edges.push({ from: 'SUM', to: 'FWD' });
    edges.push({ from: 'FWD', to: 'OUT' });
    edges.push({ from: 'FWD', to: 'H' });
    edges.push({ from: 'H', to: 'SUM', toPort: 1 });
  }
  return { blocks, edges };
}

function formatTf(tf: TransferFunction): string {
  const num = tf.numerator;
  const den = tf.denominator;
  return `(${num.map(formatNum).join(',')}) / (${den.map(formatNum).join(',')})`;
}
function formatNum(x: number) {
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  return x.toFixed(3);
}
