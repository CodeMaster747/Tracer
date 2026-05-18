import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { drawTitle, drawXYReference, xyLineY, pageCenterX, PAGE } from './layout';
import { deg2rad, ellipsePoints, fmt, regularPolygon, rotateAbout } from './geometry';

export type SectionSolidShape = 'prism' | 'pyramid' | 'cube' | 'cylinder' | 'cone';

/** Cutting plane is defined by its inclination to HP/VP and the point on the axis where it cuts. */
export interface SectionSpec {
  shape: SectionSolidShape;
  sizeMm: number;
  axisMm?: number;
  sides?: number;
  /** Inclination of the cutting plane to HP (positive). */
  cutInclinationDeg: number;
  /**
   * Position of the cutting plane along the axis, measured from the base (0..1 fraction
   * of the axis height). 0.5 cuts through the centre.
   */
  cutHeightFrac: number;
}

interface SectionResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

/**
 * Compute the section of the solid by a plane perpendicular to VP (so it appears as a
 * straight line in the front view) and inclined to HP at the given angle. We:
 *
 *   1. Project the solid (axis ⟂ HP).
 *   2. Draw the cutting line in the FV.
 *   3. Find where the cutting line meets each visible edge — those points are vertices
 *      of the section.
 *   4. Project those vertices to the top view to draw the apparent section (the
 *      foreshortened section).
 *   5. Rotate the section into a plane parallel to HP to draw the TRUE SHAPE.
 */
export function buildSectionOfSolid(spec: SectionSpec): SectionResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(builder, `Section of ${solidLabel(spec)} (cutting plane ${spec.cutInclinationDeg}° to HP)`);
  drawXYReference(builder);

  // Build the 3D vertex set + edge list, axis ⟂ HP (Z up).
  const model = solidModel(spec);

  // Place the solid centred on the page horizontally; lift TV/FV away from XY.
  const cx = pageCenterX();
  const xs = model.vertices.map((v) => v[0]);
  const cxObj = (Math.min(...xs) + Math.max(...xs)) / 2;
  const shiftX = cx - cxObj;
  const ys = model.vertices.map((v) => v[1]);
  const shiftY = 25 - Math.min(...ys); // TV depth from VP ≥ 25mm
  const verts = model.vertices.map(
    (v): [number, number, number] => [v[0] + shiftX, v[1] + shiftY, v[2]]
  );

  const xy = xyLineY();
  const fv = (v: [number, number, number]): Pt => ({ x: v[0], y: xy - v[2] });
  const tv = (v: [number, number, number]): Pt => ({ x: v[0], y: xy + v[1] });

  // Draw uncut solid (FV + TV) as construction lines first
  for (const [a, b] of model.edges) {
    builder.line({
      tool: '2H Pencil',
      instruction: `FV edge V${a + 1}-V${b + 1}`,
      from: fv(verts[a]),
      to: fv(verts[b]),
      layer: 'construction',
    });
    builder.line({
      tool: '2H Pencil',
      instruction: `TV edge V${a + 1}-V${b + 1}`,
      from: tv(verts[a]),
      to: tv(verts[b]),
      layer: 'construction',
    });
  }

  // Cutting line in FV. Plane is perpendicular to VP, so it appears as a straight line in FV.
  // It passes through the point on the axis at height (cutHeightFrac × axisMm) and is
  // inclined at cutInclinationDeg to XY.
  const axisH = (spec.axisMm ?? spec.sizeMm * 1.5);
  const cutZ = axisH * spec.cutHeightFrac;
  const axisX = cx;
  const cutAngle = deg2rad(spec.cutInclinationDeg);
  // The line passes through (axisX, xy - cutZ) and tilts at `cutAngle` to horizontal.
  const cutPt: Pt = { x: axisX, y: xy - cutZ };
  // Two endpoints of the cutting line that extend across the whole FV box
  const reach = 200;
  const dx = Math.cos(cutAngle);
  const dy = -Math.sin(cutAngle);
  const cutA: Pt = { x: cutPt.x - reach * dx, y: cutPt.y - reach * dy };
  const cutB: Pt = { x: cutPt.x + reach * dx, y: cutPt.y + reach * dy };
  builder.line({
    tool: 'HB Pencil',
    instruction: `Cutting plane line in FV — through height ${fmt(cutZ)}mm above HP, inclined ${
      spec.cutInclinationDeg
    }° to XY`,
    from: cutA,
    to: cutB,
    layer: 'final',
  });

  // Find intersection points of the cutting line with each FV edge.
  // We then project the intersections to the TV.
  const sectionPointsFv: Pt[] = [];
  const sectionPointsTv: Pt[] = [];
  const sectionPointsTrue: Pt[] = []; // (s, d) coords for the true-shape view

  for (const [a, b] of model.edges) {
    const fA = fv(verts[a]);
    const fB = fv(verts[b]);
    const ipFv = lineLineIntersection(cutA, cutB, fA, fB);
    if (!ipFv) continue;
    if (!isBetween(ipFv, fA, fB) || !isBetween(ipFv, cutA, cutB)) continue;
    sectionPointsFv.push(ipFv);

    // Linear interpolation parameter on the original edge in 3D
    const dE = distSq(fA, fB);
    const t = dE === 0 ? 0 : Math.sqrt(distSq(fA, ipFv) / dE);
    const inter3D: [number, number, number] = [
      verts[a][0] + t * (verts[b][0] - verts[a][0]),
      verts[a][1] + t * (verts[b][1] - verts[a][1]),
      verts[a][2] + t * (verts[b][2] - verts[a][2]),
    ];
    sectionPointsTv.push(tv(inter3D));

    // For the true shape: coordinates in the cutting plane.
    //   s = signed distance along the cutting line (FV) from cutPt
    //   d = perpendicular distance (depth from VP, = inter3D[1])
    const sx = ipFv.x - cutPt.x;
    const sy = ipFv.y - cutPt.y;
    const s = sx * Math.cos(cutAngle) - sy * Math.sin(cutAngle);
    const d = inter3D[1] - shiftY; // remove the layout shift so depth is "behind VP"
    sectionPointsTrue.push({ x: s, y: d });
  }

  // Order the TV section points around their centroid for a clean polygon
  const orderedTv = orderAroundCentroid(sectionPointsTv);
  const orderedTrue = orderAroundCentroid(sectionPointsTrue);

  // Hatch the section in TV (apparent section)
  if (orderedTv.length >= 3) {
    builder.curve({
      tool: 'HB Pencil',
      instruction: 'Top view: outline of the apparent section (foreshortened)',
      points: orderedTv,
      closed: true,
      layer: 'final',
    });
    addHatch(builder, orderedTv, 4, 'TV');
  }

  // Draw the TRUE SHAPE off to the side (translated to upper-right area)
  if (orderedTrue.length >= 3) {
    const ts = translateAndCentre(orderedTrue, { x: PAGE.widthMm - 90, y: xy - 80 });
    builder.curve({
      tool: 'HB Pencil',
      instruction: 'TRUE shape of the section — drawn by rotating the cutting plane into the picture plane',
      points: ts,
      closed: true,
      layer: 'final',
    });
    addHatch(builder, ts, 4, 'TRUE');
    builder.text({
      instruction: 'Label: true shape of section',
      at: { x: PAGE.widthMm - 90, y: xy - 130 },
      text: 'TRUE SHAPE OF SECTION',
      align: 'middle',
      fontSize: 4.5,
    });
  }

  return {
    strokes: builder.build(),
    paper,
    summary: `Cutting plane: perpendicular to VP, inclined ${
      spec.cutInclinationDeg
    }° to HP, passing through a point ${fmt(cutZ)}mm above HP on the axis. In the front view the section appears as the cutting line itself. Its intersections with the visible edges are projected vertically downward to give the foreshortened section in the top view. Rotating the cutting plane parallel to HP gives the TRUE SHAPE of the section, drawn at the right of the page.`,
  };
}

/* ----- 3D models for sectioning (axis ⟂ HP) ----- */

interface SolidModel {
  vertices: Array<[number, number, number]>;
  edges: Array<[number, number]>;
}

function solidModel(spec: SectionSpec): SolidModel {
  switch (spec.shape) {
    case 'cube': {
      const L = spec.sizeMm;
      const v: Array<[number, number, number]> = [];
      for (let z = 0; z <= 1; z++) {
        for (let y = 0; y <= 1; y++) {
          for (let x = 0; x <= 1; x++) {
            v.push([(x - 0.5) * L, (y - 0.5) * L, z * L]);
          }
        }
      }
      const e: Array<[number, number]> = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      return { vertices: v, edges: e };
    }
    case 'prism':
    case 'pyramid': {
      const n = spec.sides ?? 6;
      const side = spec.sizeMm;
      const r = side / (2 * Math.sin(Math.PI / n));
      const h = spec.axisMm ?? side * 1.5;
      const start = n === 4 ? -Math.PI / 4 : n === 6 ? 0 : -Math.PI / 2;
      const base = regularPolygon({ x: 0, y: 0 }, r, n, start);
      const v: Array<[number, number, number]> = base.map((p) => [p.x, p.y, 0]);
      if (spec.shape === 'prism') {
        v.push(...base.map((p): [number, number, number] => [p.x, p.y, h]));
        const e: Array<[number, number]> = [];
        for (let i = 0; i < n; i++) {
          e.push([i, (i + 1) % n]);
          e.push([n + i, n + ((i + 1) % n)]);
          e.push([i, n + i]);
        }
        return { vertices: v, edges: e };
      } else {
        v.push([0, 0, h]);
        const apex = n;
        const e: Array<[number, number]> = [];
        for (let i = 0; i < n; i++) {
          e.push([i, (i + 1) % n]);
          e.push([i, apex]);
        }
        return { vertices: v, edges: e };
      }
    }
    case 'cylinder': {
      const R = spec.sizeMm / 2;
      const h = spec.axisMm ?? spec.sizeMm * 1.5;
      const N = 24;
      const base: Array<[number, number, number]> = [];
      const top: Array<[number, number, number]> = [];
      for (let i = 0; i < N; i++) {
        const a = (2 * Math.PI * i) / N;
        base.push([R * Math.cos(a), R * Math.sin(a), 0]);
        top.push([R * Math.cos(a), R * Math.sin(a), h]);
      }
      const v: Array<[number, number, number]> = [...base, ...top];
      const e: Array<[number, number]> = [];
      for (let i = 0; i < N; i++) {
        e.push([i, (i + 1) % N]);
        e.push([N + i, N + ((i + 1) % N)]);
        e.push([i, N + i]); // straight-line generators
      }
      return { vertices: v, edges: e };
    }
    case 'cone': {
      const R = spec.sizeMm / 2;
      const h = spec.axisMm ?? spec.sizeMm * 1.5;
      const N = 24;
      const base: Array<[number, number, number]> = [];
      for (let i = 0; i < N; i++) {
        const a = (2 * Math.PI * i) / N;
        base.push([R * Math.cos(a), R * Math.sin(a), 0]);
      }
      const apex: [number, number, number] = [0, 0, h];
      const v: Array<[number, number, number]> = [...base, apex];
      const e: Array<[number, number]> = [];
      for (let i = 0; i < N; i++) {
        e.push([i, (i + 1) % N]);
        e.push([i, N]);
      }
      return { vertices: v, edges: e };
    }
  }
}

/* ----- 2D helpers ----- */

function lineLineIntersection(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(d) < 1e-9) return null;
  const tNum = (a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x);
  const t = tNum / d;
  return {
    x: a1.x + t * (a2.x - a1.x),
    y: a1.y + t * (a2.y - a1.y),
  };
}

function isBetween(p: Pt, a: Pt, b: Pt): boolean {
  const minX = Math.min(a.x, b.x) - 1e-6;
  const maxX = Math.max(a.x, b.x) + 1e-6;
  const minY = Math.min(a.y, b.y) - 1e-6;
  const maxY = Math.max(a.y, b.y) + 1e-6;
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

function distSq(a: Pt, b: Pt): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function orderAroundCentroid(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice();
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function translateAndCentre(pts: Pt[], target: Pt): Pt[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map((p) => ({ x: p.x - cx + target.x, y: p.y - cy + target.y }));
}

function addHatch(builder: StrokeBuilder, polygon: Pt[], spacingMm: number, tag: string): void {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += spacingMm) {
    const lineA: Pt = { x, y: minY - spacingMm };
    const lineB: Pt = { x: x + (maxY - minY) + 2 * spacingMm, y: maxY + spacingMm };
    const hits = polygonClip(polygon, lineA, lineB);
    if (hits.length === 2) {
      builder.line({
        tool: 'HB Pencil',
        instruction: `${tag}: hatching line`,
        from: hits[0],
        to: hits[1],
        layer: 'final',
      });
    }
  }
}

function polygonClip(polygon: Pt[], a: Pt, b: Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const ip = lineLineIntersection(a, b, p1, p2);
    if (ip && isBetween(ip, p1, p2) && isBetween(ip, a, b)) out.push(ip);
  }
  return out;
}

function solidLabel(spec: SectionSpec): string {
  switch (spec.shape) {
    case 'cube':
      return `cube of side ${fmt(spec.sizeMm)}mm`;
    case 'cylinder':
      return `cylinder Ø${fmt(spec.sizeMm)}mm × ${fmt(spec.axisMm ?? spec.sizeMm * 1.5)}mm`;
    case 'cone':
      return `cone Ø${fmt(spec.sizeMm)}mm × ${fmt(spec.axisMm ?? spec.sizeMm * 1.5)}mm`;
    case 'prism':
      return `${prismName(spec.sides ?? 6)} prism, side ${fmt(spec.sizeMm)}mm × axis ${fmt(
        spec.axisMm ?? spec.sizeMm * 1.5
      )}mm`;
    case 'pyramid':
      return `${prismName(spec.sides ?? 6)} pyramid, base side ${fmt(spec.sizeMm)}mm × axis ${fmt(
        spec.axisMm ?? spec.sizeMm * 1.5
      )}mm`;
  }
}

function prismName(n: number): string {
  return n === 3 ? 'triangular' :
    n === 4 ? 'square' :
    n === 5 ? 'pentagonal' :
    n === 6 ? 'hexagonal' :
    n === 7 ? 'heptagonal' :
    n === 8 ? 'octagonal' : `${n}-sided`;
}

/* unused export markers */
export { rotateAbout, ellipsePoints };
