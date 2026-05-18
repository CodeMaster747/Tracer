/**
 * Smart parser + topic detector for the Control Systems engine.
 *
 * Returns a {topic, payload} object that the dispatcher can route through the
 * appropriate solver.
 */
import { parseTransferFunction, type TransferFunction } from './transferFunction';
import { parsePolynomial } from './polynomial';
import { parseStateSpace } from './stateSpace';
import { parseBlockDiagramSpec, type BlockSpec } from './blockDiagram';
import { parseSFG, type SFGSpec } from './signalFlowGraph';

export type ControlTopic =
  | 'pole-zero'
  | 'routh'
  | 'bode'
  | 'nyquist'
  | 'polar'
  | 'root-locus'
  | 'step-response'
  | 'impulse-response'
  | 'ramp-response'
  | 'time-response'
  | 'first-order'
  | 'second-order'
  | 'state-space'
  | 'tf-to-ss'
  | 'ss-to-tf'
  | 'controllability'
  | 'observability'
  | 'state-transition'
  | 'block-reduction'
  | 'sfg-mason'
  | 'feedback'
  | 'pid'
  | 'pi'
  | 'pd'
  | 'lead'
  | 'lag'
  | 'lead-lag'
  | 'mech-modeling'
  | 'elec-modeling'
  | 'analogous'
  | 'dc-motor'
  | 'servo'
  | 'frequency-response'
  | 'gain-phase-margin'
  | 'stability'
  | 'unknown';

export interface ParsedQuestion {
  topic: ControlTopic;
  /** parsed TF if found */
  tf?: TransferFunction;
  /** characteristic polynomial (for routh on bare poly) */
  poly?: number[];
  /** state-space spec if present */
  ss?: import('./controlTypes').StateSpace;
  /** block-diagram spec if present */
  block?: BlockSpec;
  /** signal-flow-graph spec if present */
  sfg?: SFGSpec;
  /** numeric extras (e.g. K, Ku, Tu, etc.) */
  params?: Record<string, number>;
  rawText: string;
}

/* ---------- Topic patterns ---------- */
const TOPIC_PATTERNS: { topic: ControlTopic; rx: RegExp }[] = [
  { topic: 'pole-zero', rx: /(pole[-\s]?zero|pz\s*plot|pole\s*zero\s*map)/i },
  { topic: 'routh', rx: /(routh|hurwitz|routh-?hurwitz)/i },
  { topic: 'nyquist', rx: /\bnyquist\b/i },
  { topic: 'polar', rx: /\bpolar\s*plot\b/i },
  { topic: 'bode', rx: /\b(bode|frequency\s*response|magnitude\s*plot|phase\s*plot)\b/i },
  { topic: 'root-locus', rx: /\broot[-\s]?locus\b/i },
  { topic: 'step-response', rx: /\b(step\s*response|step\s*input)\b/i },
  { topic: 'impulse-response', rx: /\b(impulse\s*response|impulse\s*input)\b/i },
  { topic: 'ramp-response', rx: /\bramp\s*response\b/i },
  { topic: 'second-order', rx: /\b(second[-\s]?order|2nd[-\s]?order|underdamped|overdamped|critically\s*damped)\b/i },
  { topic: 'first-order', rx: /\b(first[-\s]?order|1st[-\s]?order)\b/i },
  { topic: 'controllability', rx: /\b(controllab|controllability)/i },
  { topic: 'observability', rx: /\b(observab|observability)/i },
  { topic: 'state-transition', rx: /\bstate[-\s]?transition\s*matrix\b/i },
  { topic: 'tf-to-ss', rx: /\b(tf|transfer\s*function)\s*(to|→)\s*(ss|state[-\s]?space)/i },
  { topic: 'ss-to-tf', rx: /\b(ss|state[-\s]?space)\s*(to|→)\s*(tf|transfer\s*function)/i },
  { topic: 'state-space', rx: /\bstate[-\s]?space\b/i },
  { topic: 'block-reduction', rx: /\bblock[-\s]?(diagram|reduction)\b/i },
  { topic: 'sfg-mason', rx: /\b(signal[-\s]?flow\s*graph|sfg|mason)/i },
  { topic: 'feedback', rx: /\b(feedback\s*system|closed[-\s]?loop\s*transfer)\b/i },
  { topic: 'pid', rx: /\bpid\b/i },
  { topic: 'pi', rx: /\bpi\s*controller\b/i },
  { topic: 'pd', rx: /\bpd\s*controller\b/i },
  { topic: 'lead-lag', rx: /\blead[-\s]?lag\b/i },
  { topic: 'lead', rx: /\blead\s*compensator\b/i },
  { topic: 'lag', rx: /\blag\s*compensator\b/i },
  { topic: 'analogous', rx: /\banalog(ous)?\s*system/i },
  { topic: 'mech-modeling', rx: /\b(mass[-\s]?spring(?:[-\s]?damper)?|mechanical\s*system)\b/i },
  { topic: 'elec-modeling', rx: /\b(rlc\s*circuit|rc\s*circuit|electrical\s*(?:system|circuit))\b/i },
  { topic: 'dc-motor', rx: /\b(dc\s*motor|armature[-\s]?controlled|field[-\s]?controlled)\b/i },
  { topic: 'servo', rx: /\bservo\b/i },
  { topic: 'gain-phase-margin', rx: /\b(gain\s*margin|phase\s*margin|stability\s*margin)\b/i },
  { topic: 'stability', rx: /\bstabil(ity|ize|ise)\b/i },
];

export function detectTopic(text: string): ControlTopic {
  for (const { topic, rx } of TOPIC_PATTERNS) {
    if (rx.test(text)) return topic;
  }
  return 'unknown';
}

/* ---------- TF extraction ---------- */

/**
 * Tries to find a transfer function in the text. Looks for, in order:
 *   1. labelled form    "G(s) = … / …"
 *   2. parens-pair      "(...) / (...)"
 *   3. polynomial-pair  "poly / poly"
 *   4. bare denominator with leading "1/" or "K/" — then treat K as numerator coef.
 *
 * Crucial: we only accept text consisting of polynomial symbols (s, digits, +, -, *, /, ^, parens, dots).
 * This prevents stray English words from corrupting the parsed polynomial.
 */
function extractTransferFunction(text: string): TransferFunction | null {
  // 1. labelled  "G(s) = …"
  const labeled = text.match(/(?:G\(s\)|H\(s\)|Gc\(s\)|Y\(s\)\/U\(s\)|C\(s\)\/R\(s\))\s*=\s*([^?\n]+)/i);
  if (labeled) {
    // Truncate the RHS at the first delimiter that signals "end of TF expression":
    // a comma followed by a letter (parameter list), or a semicolon, etc.
    let rhsRaw = labeled[1];
    const cut = rhsRaw.search(/(?:,\s*[A-Za-z]|;|\bwhere\b)/);
    if (cut > 0) rhsRaw = rhsRaw.slice(0, cut);
    const rhs = trimTfExpression(rhsRaw);
    if (rhs) {
      try { return parseTransferFunction(rhs); } catch { /* fall through */ }
    }
  }

  // 2. parens-pair: (…) / (…), where each (…) is a balanced expression
  const parenPair = findParenSlashParen(text);
  if (parenPair) {
    try { return parseTransferFunction(parenPair); } catch { /* fall through */ }
  }

  // 3. polynomial-pair: "<poly> / <poly>" with no parens
  const polyPair = findPolySlashPoly(text);
  if (polyPair) {
    try { return parseTransferFunction(polyPair); } catch { /* ignore */ }
  }
  return null;
}

/**
 * Walk the string and find the first occurrence of a balanced "(...) / (...)" expression.
 * Returns the matched substring or null.
 */
function findParenSlashParen(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(') continue;
    const close = findMatching(text, i);
    if (close < 0) continue;
    // After this closing paren, optional spaces, '/', optional spaces, '(' for denominator
    let j = close + 1;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== '/') continue;
    j++;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== '(') continue;
    const close2 = findMatching(text, j);
    if (close2 < 0) continue;
    const num = text.slice(i, close + 1);
    const den = text.slice(j, close2 + 1);
    // Sanity: both sides must contain 's' OR be constants
    if (/[s\d]/.test(num) && /[s\d]/.test(den)) {
      return `${num}/${den}`;
    }
  }
  return null;
}

function findMatching(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Match bare-polynomial / polynomial without parens. Used as a last-resort.
 *  We scan for "/" and grab a small token on each side that *only* contains
 *  polynomial chars (s, digits, +-*^.). This avoids catastrophic regex backtracking. */
function findPolySlashPoly(text: string): string | null {
  // Search line-by-line so we don't span newlines.
  for (const line of text.split(/\n/)) {
    const idx = line.indexOf('/');
    if (idx < 0) continue;
    // skip if line contains parens (handled by findParenSlashParen already)
    if (line.indexOf('(') >= 0) continue;
    const leftRaw = line.slice(0, idx);
    const rightRaw = line.slice(idx + 1);
    const left = trimTfExpression(leftRaw);
    const right = trimTfExpression(rightRaw);
    if (!left || !right) continue;
    // require at least one 's' across both sides
    if (!/s/i.test(left + right)) continue;
    return `${left}/${right}`;
  }
  return null;
}

/**
 * Validate a candidate transfer-function expression: only s, digits, operators, parens, dots, spaces, ², ³, etc.
 * Returns the trimmed expression with `K`/`k` replaced by 1 (root-locus convention), or null if it
 * contains other letters.
 */
function trimTfExpression(s: string): string | null {
  let trimmed = s.trim().replace(/[?,;.]$/, '').trim();
  if (!trimmed) return null;
  // Replace "K" multiplier with 1 (root-locus convention).  Bare K → "1"; K· or K* → "1·"; K(…) → "1(…)".
  trimmed = trimmed.replace(/\bK\b/g, '1');
  if (!/^[\s\d+\-*/().s^²³⁴⁵⁶]+$/i.test(trimmed)) return null;
  return trimmed;
}

function extractBarePolynomial(text: string): number[] | null {
  // Routh on a bare characteristic polynomial
  const m = text.match(/([+\-]?\s*\d*\s*s\s*\^?\s*\d*(?:\s*[+\-]\s*\d*\s*s?\s*\^?\s*\d*)+(?:\s*[+\-]\s*\d+)?)/);
  if (!m) return null;
  try { return parsePolynomial(m[1]); } catch { return null; }
}

function extractParams(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  // Look for key=value pairs (e.g. Kp=2.5, J=0.01, R=1, L=0.5, Kt=0.1)
  const re = /\b([A-Za-z][\w_]*)\s*=\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const val = Number(m[2]);
    if (!Number.isFinite(val)) continue;
    // Skip 'G' or 'H' which name TFs
    if (/^[A-Z]\(s\)$/i.test(name)) continue;
    out[name] = val;
  }
  return out;
}

function extractStateSpace(text: string): import('./controlTypes').StateSpace | null {
  if (!/A\s*=/.test(text)) return null;
  try { return parseStateSpace(text); } catch { return null; }
}

function extractBlockSpec(text: string): BlockSpec | null {
  if (!/(series|parallel|feedback)/i.test(text)) return null;
  const spec = parseBlockDiagramSpec(text);
  if (spec.ops.length === 0) return null;
  return spec;
}

function extractSFG(text: string): SFGSpec | null {
  if (!/(->|--?[A-Za-z\d ]+--?>)/.test(text)) return null;
  const spec = parseSFG(text);
  if (spec.branches.length === 0) return null;
  return spec;
}

/* ---------- Public ---------- */

export function parseControlQuestion(text: string): ParsedQuestion {
  const topic = detectTopic(text);
  const tf = extractTransferFunction(text);
  const poly = tf ? null : extractBarePolynomial(text);
  return {
    topic,
    tf: tf ?? undefined,
    poly: poly ?? undefined,
    ss: extractStateSpace(text) ?? undefined,
    block: extractBlockSpec(text) ?? undefined,
    sfg: extractSFG(text) ?? undefined,
    params: extractParams(text),
    rawText: text,
  };
}
