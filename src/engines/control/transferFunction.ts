import { type Polynomial, parsePolynomial, polyEvalComplex, complex, type Complex, polyRoots } from './polynomial';

export interface TransferFunction {
  numerator: Polynomial;
  denominator: Polynomial;
  display: string;
}

/**
 * Parse "G(s) = (s+2) / (s^2 + 3s + 2)" or "(s+2)/((s+1)(s+3))" or just "1/(s^2 + s + 1)".
 */
export function parseTransferFunction(text: string): TransferFunction {
  let cleaned = text.replace(/\s+/g, '');
  // Drop "G(s)=" / "H(s)=" / "Y(s)/U(s)=" prefixes
  cleaned = cleaned.replace(/^[A-Za-z]+\(s\)=/, '');
  cleaned = cleaned.replace(/^[A-Za-z]+\(s\)\/[A-Za-z]+\(s\)=/, '');

  // Split on top-level '/'
  const slashIdx = topLevelSlash(cleaned);
  let num: Polynomial;
  let den: Polynomial;
  if (slashIdx < 0) {
    num = parsePolynomial(cleaned);
    den = [1];
  } else {
    const numStr = stripOuterParen(cleaned.slice(0, slashIdx));
    const denStr = stripOuterParen(cleaned.slice(slashIdx + 1));
    num = parsePolynomial(numStr);
    den = parsePolynomial(denStr);
  }

  return {
    numerator: num,
    denominator: den,
    display: text.trim(),
  };
}

function topLevelSlash(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '/' && depth === 0) return i;
  }
  return -1;
}

function stripOuterParen(s: string): string {
  let t = s.trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    let depth = 0;
    let strip = true;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') {
        depth--;
        if (depth === 0 && i < t.length - 1) {
          strip = false;
          break;
        }
      }
    }
    if (!strip) break;
    t = t.slice(1, -1);
  }
  return t;
}

export function getPoles(tf: TransferFunction): Complex[] {
  return polyRoots(tf.denominator);
}

export function getZeros(tf: TransferFunction): Complex[] {
  return polyRoots(tf.numerator);
}

export function evalTfAtJOmega(tf: TransferFunction, omega: number): Complex {
  const z = complex(0, omega);
  const num = polyEvalComplex(tf.numerator, z);
  const den = polyEvalComplex(tf.denominator, z);
  if (den.re === 0 && den.im === 0) return { re: NaN, im: NaN };
  return cDiv(num, den);
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}
