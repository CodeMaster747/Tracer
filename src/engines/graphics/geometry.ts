import type { Pt } from '@/engines/types';

/* ----- Vector helpers ----- */

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(a: Pt, k: number): Pt {
  return { x: a.x * k, y: a.y * k };
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function midpoint(a: Pt, b: Pt): Pt {
  return lerp(a, b, 0.5);
}
export function angleBetween(a: Pt, b: Pt): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/* ----- Rotations and transforms ----- */

/** Rotate point `p` about origin `o` by `rad` (positive = CCW in math, but
 *  on screen the y-axis grows down, so a positive angle here visually rotates CW). */
export function rotateAbout(p: Pt, o: Pt, rad: number): Pt {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
}

/** Project point `p` onto the line through `a` in direction `dir`. */
export function projectOnLine(p: Pt, a: Pt, dir: Pt): Pt {
  const denom = dir.x * dir.x + dir.y * dir.y;
  if (denom === 0) return a;
  const t = ((p.x - a.x) * dir.x + (p.y - a.y) * dir.y) / denom;
  return { x: a.x + dir.x * t, y: a.y + dir.y * t };
}

/* ----- Regular polygons ----- */

/** Vertices of a regular n-gon centred at `c` with circum-radius `r`.
 *  `startAngleRad` is the angle of the first vertex measured from +x axis (CCW math).
 *  In screen coords (y grows down), pass -Math.PI/2 to put the first vertex at the top.
 */
export function regularPolygon(c: Pt, r: number, n: number, startAngleRad = -Math.PI / 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = startAngleRad + (i * 2 * Math.PI) / n;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

/** Side length given circum-radius and number of sides. */
export function polygonSideFromRadius(r: number, n: number): number {
  return 2 * r * Math.sin(Math.PI / n);
}

/** Circum-radius given side length and number of sides. */
export function polygonRadiusFromSide(side: number, n: number): number {
  return side / (2 * Math.sin(Math.PI / n));
}

/** Apothem (centre-to-edge-midpoint distance). */
export function polygonApothem(r: number, n: number): number {
  return r * Math.cos(Math.PI / n);
}

/* ----- Polygon analysis ----- */

export function polygonCentroid(pts: Pt[]): Pt {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / pts.length, y: cy / pts.length };
}

/** Signed area (positive for CCW in math conventions). */
export function polygonSignedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a / 2;
}

/* ----- Round number formatting ----- */

export function fmt(n: number, decimals = 1): string {
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(decimals);
}

/* ----- Linear interpolation along a polyline ----- */

/** Resample a polyline to `count` equally-spaced points (by arc length). */
export function resamplePolyline(pts: Pt[], count: number): Pt[] {
  if (pts.length < 2 || count < 2) return pts.slice();
  const cumLen: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumLen.push(cumLen[i - 1] + dist(pts[i - 1], pts[i]));
  }
  const total = cumLen[cumLen.length - 1];
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);
    // Find segment
    let seg = 0;
    while (seg < cumLen.length - 1 && cumLen[seg + 1] < target) seg++;
    const segLen = cumLen[seg + 1] - cumLen[seg];
    const t = segLen === 0 ? 0 : (target - cumLen[seg]) / segLen;
    out.push(lerp(pts[seg], pts[seg + 1], t));
  }
  return out;
}

/* ----- Ellipse sampling ----- */

/** N points on an ellipse centred at `c` with horizontal radius `rx`, vertical radius `ry`,
 *  tilted by `rotRad` (CCW math).
 */
export function ellipsePoints(
  c: Pt,
  rx: number,
  ry: number,
  count: number,
  rotRad = 0
): Pt[] {
  const cs = Math.cos(rotRad);
  const sn = Math.sin(rotRad);
  const out: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const t = (i * 2 * Math.PI) / count;
    const px = rx * Math.cos(t);
    const py = ry * Math.sin(t);
    out.push({ x: c.x + px * cs - py * sn, y: c.y + px * sn + py * cs });
  }
  return out;
}

/* ----- Number parsing helpers ----- */

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

export function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}
