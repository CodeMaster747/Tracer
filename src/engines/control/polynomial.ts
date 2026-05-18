/**
 * Polynomial in s, represented as coefficients from highest degree to lowest.
 * e.g. s^2 + 3s + 2 → [1, 3, 2]
 */

export type Polynomial = number[];

export interface Complex {
  re: number;
  im: number;
}

export function complex(re: number, im = 0): Complex {
  return { re, im };
}

export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}
export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}
export function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return { re: NaN, im: NaN };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}
export function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}
export function cArg(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

export function polyEval(p: Polynomial, x: number): number {
  let acc = 0;
  for (const c of p) {
    acc = acc * x + c;
  }
  return acc;
}

export function polyEvalComplex(p: Polynomial, z: Complex): Complex {
  let acc = complex(0, 0);
  for (const c of p) {
    acc = cAdd(cMul(acc, z), complex(c, 0));
  }
  return acc;
}

export function polyDeg(p: Polynomial): number {
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.length - 1 - i;
}

export function polyDeflate(p: Polynomial): Polynomial {
  // Strip leading zeros
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.slice(i);
}

export function polyDerivative(p: Polynomial): Polynomial {
  const n = p.length - 1;
  if (n === 0) return [0];
  const out: Polynomial = [];
  for (let i = 0; i < n; i++) {
    out.push(p[i] * (n - i));
  }
  return out;
}

/**
 * Find all roots of a polynomial via Durand-Kerner method.
 * Returns complex roots; real-valued roots will have small imaginary part (round to 0 by caller).
 */
export function polyRoots(input: Polynomial): Complex[] {
  const p = polyDeflate(input).slice();
  const n = polyDeg(p);
  if (n === 0) return [];
  // Normalize so leading coefficient is 1
  const lead = p[0];
  for (let i = 0; i < p.length; i++) p[i] /= lead;

  // Initial guesses: equally spaced around a circle of radius 1, slightly tilted
  const roots: Complex[] = [];
  const r0 = 1.0;
  const phi0 = 0.4;
  for (let i = 0; i < n; i++) {
    const theta = phi0 + (2 * Math.PI * i) / n;
    roots.push({ re: r0 * Math.cos(theta), im: r0 * Math.sin(theta) });
  }

  // Iterate
  const maxIter = 200;
  const tol = 1e-12;
  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      const xi = roots[i];
      let denom: Complex = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        denom = cMul(denom, cSub(xi, roots[j]));
      }
      const num = polyEvalComplex(p, xi);
      const delta = cDiv(num, denom);
      roots[i] = cSub(xi, delta);
      const m = cAbs(delta);
      if (m > maxDelta) maxDelta = m;
    }
    if (maxDelta < tol) break;
  }

  // Clean up: zero-out tiny imaginary parts
  for (const r of roots) {
    if (Math.abs(r.im) < 1e-8) r.im = 0;
    if (Math.abs(r.re) < 1e-12) r.re = 0;
  }
  return roots;
}

/**
 * Parse a polynomial-in-s expression like:
 *   "s^2 + 3s + 2"
 *   "s^3 - 2s + 1"
 *   "2s^2 + s"
 *   "(s+1)(s+3)"
 *   "(s+2)(s^2+3s+5)"
 * Returns coefficients high→low.
 */
export function parsePolynomial(text: string): Polynomial {
  let cleaned = text
    .replace(/\s+/g, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/⁶/g, '^6');

  // Expand parenthesized factors: e.g. (s+1)(s+3) -> distribute
  if (cleaned.includes('(')) {
    cleaned = expandFactored(cleaned);
  }

  return parseSumOfTerms(cleaned);
}

function parseSumOfTerms(t: string): Polynomial {
  const tokens = tokenizeTerms(t);
  const map = new Map<number, number>();
  for (const tok of tokens) {
    const { coef, deg } = parseTerm(tok);
    map.set(deg, (map.get(deg) ?? 0) + coef);
  }
  if (map.size === 0) return [0];
  const maxDeg = Math.max(...map.keys());
  const out: number[] = [];
  for (let d = maxDeg; d >= 0; d--) out.push(map.get(d) ?? 0);
  return out;
}

function tokenizeTerms(t: string): string[] {
  // Split by + or - while keeping the sign
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if ((c === '+' || c === '-') && cur.length > 0 && t[i - 1] !== '^' && t[i - 1] !== '*') {
      out.push(cur);
      cur = c === '-' ? '-' : '';
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out.filter((x) => x !== '' && x !== '+' && x !== '-');
}

function parseTerm(tok: string): { coef: number; deg: number } {
  // Forms: "3s^2", "-2s", "s", "5", "-s^3"
  let s = tok;
  let sign = 1;
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  if (!s.includes('s')) {
    return { coef: sign * Number(s), deg: 0 };
  }
  const sIdx = s.indexOf('s');
  let coefStr = s.slice(0, sIdx);
  if (coefStr === '' || coefStr === '*') coefStr = '1';
  if (coefStr.endsWith('*')) coefStr = coefStr.slice(0, -1);
  const coef = sign * Number(coefStr);

  const rest = s.slice(sIdx + 1);
  if (rest === '' || rest === '+1' || rest === '^1') {
    return { coef, deg: 1 };
  }
  if (rest.startsWith('^')) {
    return { coef, deg: Number(rest.slice(1)) };
  }
  return { coef, deg: 1 };
}

function expandFactored(t: string): string {
  // Pull out parenthesized factors and multiply them.
  // Approach: walk top-level multiplications.
  const factors: Polynomial[] = [];
  let cur = '';
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === '(') {
      const close = matchClose(t, i);
      const inner = t.slice(i + 1, close);
      if (cur.length > 0) {
        factors.push(parseSumOfTerms(cur));
        cur = '';
      }
      factors.push(parseSumOfTerms(inner));
      i = close + 1;
      // optional explicit '*'
      if (t[i] === '*') i++;
    } else {
      cur += c;
      i++;
    }
  }
  if (cur.length > 0) factors.push(parseSumOfTerms(cur));
  if (factors.length === 0) return '0';
  let acc = factors[0];
  for (let f = 1; f < factors.length; f++) acc = polyMul(acc, factors[f]);
  return polyToString(acc);
}

function matchClose(t: string, openIdx: number): number {
  let depth = 1;
  for (let i = openIdx + 1; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('Unmatched parenthesis');
}

export function polyMul(a: Polynomial, b: Polynomial): Polynomial {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

export function polyToString(p: Polynomial): string {
  const n = p.length - 1;
  const parts: string[] = [];
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    const d = n - i;
    if (c === 0) continue;
    const sign = c >= 0 ? '+' : '-';
    const mag = Math.abs(c);
    let term = '';
    if (d === 0) term = `${mag}`;
    else if (d === 1) term = `${mag === 1 ? '' : mag}s`;
    else term = `${mag === 1 ? '' : mag}s^${d}`;
    parts.push(`${sign}${term}`);
  }
  if (parts.length === 0) return '0';
  if (parts[0].startsWith('+')) parts[0] = parts[0].slice(1);
  return parts.join('');
}
