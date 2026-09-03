import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { drawTitle, drawXYReference, xyLineY, pageCenterX } from './layout';
import { deg2rad, ellipsePoints, fmt, regularPolygon, rotateAbout } from './geometry';

export type SolidShape =
  | 'prism' // n-gonal prism
  | 'pyramid' // n-gonal pyramid
  | 'cube'
  | 'tetrahedron'
  | 'cylinder'
  | 'cone';

export type AxisPose =
  | 'perpendicular-to-HP'
  | 'perpendicular-to-VP'
  | 'parallel-to-both'
  | 'inclined-to-HP'
  | 'inclined-to-VP';

export interface SolidSpec {
  shape: SolidShape;
  /** Base side or diameter in mm. */
  sizeMm: number;
  /** Axis height (for prism/pyramid/cylinder/cone). Ignored for cube/tetrahedron. */
  axisMm?: number;
  /** Number of sides for prism/pyramid (3..12). */
  sides?: number;
  /** Pose of axis with respect to HP/VP. */
  pose: AxisPose;
  /** Axis inclination in degrees (used with inclined-* poses). */
  inclinationDeg?: number;
}

interface SolidResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

/**
 * Build the 2-view projection (top + front) of a solid.
 * Coordinate convention:
 *   3D space: x right, y depth (into VP), z up. HP is the xy plane (z=0), VP is the xz plane (y=0).
 *   Front view is on VP: paper coords = (x_world, xy_paper - z_world).
 *   Top view  is on HP: paper coords = (x_world, xy_paper + y_world).
 *
 * We compute the solid's vertices in 3D and edges (pairs of vertex indices). Then we
 * project each vertex to the FV and TV, and draw each edge in both views.
 */
export function buildSolidProjection(spec: SolidSpec): SolidResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(builder, titleFor(spec));
  drawXYReference(builder);

  const shape = solidGeometry(spec);
  const inclined = applyPose(shape, spec);

  // Place horizontally centred
  const cx = pageCenterX();
  const xs = inclined.vertices.map((v) => v[0]);
  const cxObj = (Math.min(...xs) + Math.max(...xs)) / 2;
  const shiftX = cx - cxObj;

  // Lift TV away from XY: depth from VP must be >= clearMin
  const ysDepth = inclined.vertices.map((v) => v[1]);
  const clearMin = 20;
  const shiftDepth = clearMin - Math.min(...ysDepth);

  // Lift FV above XY: heights must be >= clearMin
  const zs = inclined.vertices.map((v) => v[2]);
  const minZ = Math.min(...zs);
  const shiftZ = minZ < clearMin ? clearMin - minZ : 0;

  const finalVerts = inclined.vertices.map(
    (v): [number, number, number] => [v[0] + shiftX, v[1] + shiftDepth, v[2] + shiftZ]
  );

  const xy = xyLineY();

  const fv = (v: [number, number, number]): Pt => ({ x: v[0], y: xy - v[2] });
  const tv = (v: [number, number, number]): Pt => ({ x: v[0], y: xy + v[1] });

  // Front view edges
  for (const [a, b, hidden] of inclined.edges) {
    builder.line({
      tool: hidden ? '2H Pencil' : 'HB Pencil',
      instruction: hidden
        ? `Front view: hidden edge from V${a + 1} to V${b + 1}`
        : `Front view: edge from V${a + 1} to V${b + 1}`,
      from: fv(finalVerts[a]),
      to: fv(finalVerts[b]),
      layer: hidden ? 'construction' : 'final',
    });
  }
  // Top view edges
  for (const [a, b, hidden] of inclined.edges) {
    builder.line({
      tool: hidden ? '2H Pencil' : 'HB Pencil',
      instruction: hidden
        ? `Top view: hidden edge from V${a + 1} to V${b + 1}`
        : `Top view: edge from V${a + 1} to V${b + 1}`,
      from: tv(finalVerts[a]),
      to: tv(finalVerts[b]),
      layer: hidden ? 'construction' : 'final',
    });
  }

  // Smooth curves for circular bases (cylinder/cone). The circle features carry
  // model-space centres, so they need the same centring shift the vertices got —
  // without it the ellipse is drawn around the origin, detached from its own solid.
  // Only the centre moves; uAxis/vAxis are directions.
  const finalCircles = inclined.circles.map((c) => ({
    ...c,
    centre: [c.centre[0] + shiftX, c.centre[1] + shiftDepth, c.centre[2] + shiftZ] as [
      number,
      number,
      number,
    ],
  }));
  for (const circle of finalCircles) {
    drawCircleProjection(builder, circle, finalVerts, fv, tv);
  }

  // Projectors between matching FV and TV vertices
  for (let i = 0; i < finalVerts.length; i++) {
    builder.line({
      tool: '2H Pencil',
      instruction: `Projector from FV to TV at vertex ${i + 1}`,
      from: fv(finalVerts[i]),
      to: tv(finalVerts[i]),
      layer: 'construction',
    });
  }

  return {
    strokes: builder.build(),
    paper,
    summary: summaryFor(spec, inclined.vertices.length),
  };
}

/* ----- 3D geometry of supported solids ----- */

interface SolidShape3D {
  vertices: Array<[number, number, number]>;
  /** Edge list as [vertexA, vertexB, hidden]. */
  edges: Array<[number, number, boolean]>;
  /** Optional circular features (for cylinders/cones). */
  circles: CircleFeature[];
}

interface CircleFeature {
  centre: [number, number, number];
  /** Local frame axes (so we can transform after rotations). */
  uAxis: [number, number, number];
  vAxis: [number, number, number];
  radius: number;
}

function solidGeometry(spec: SolidSpec): SolidShape3D {
  switch (spec.shape) {
    case 'cube': {
      const L = spec.sizeMm;
      const v: Array<[number, number, number]> = [];
      for (let z = 0; z <= 1; z++) {
        for (let y = 0; y <= 1; y++) {
          for (let x = 0; x <= 1; x++) {
            v.push([x * L, y * L, z * L]);
          }
        }
      }
      // Edges along the 12 axis-aligned segments
      const e: Array<[number, number, boolean]> = [
        // bottom 4
        [0, 1, false],
        [1, 3, false],
        [3, 2, false],
        [2, 0, false],
        // top 4
        [4, 5, false],
        [5, 7, false],
        [7, 6, false],
        [6, 4, false],
        // verticals
        [0, 4, false],
        [1, 5, false],
        [2, 6, false],
        [3, 7, false],
      ];
      return { vertices: v, edges: e, circles: [] };
    }
    case 'tetrahedron': {
      const L = spec.sizeMm;
      const r = L / Math.sqrt(3); // base circum-radius
      const h = (Math.sqrt(2 / 3)) * L; // apex height
      // Base: equilateral triangle in HP, centred at origin
      const base = regularPolygon({ x: 0, y: 0 }, r, 3, -Math.PI / 2);
      const v: Array<[number, number, number]> = base.map((p) => [p.x, p.y, 0]);
      v.push([0, 0, h]); // apex
      const e: Array<[number, number, boolean]> = [
        [0, 1, false],
        [1, 2, false],
        [2, 0, false],
        [0, 3, false],
        [1, 3, false],
        [2, 3, false],
      ];
      return { vertices: v, edges: e, circles: [] };
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
        const top: Array<[number, number, number]> = base.map((p) => [p.x, p.y, h]);
        v.push(...top);
        const e: Array<[number, number, boolean]> = [];
        for (let i = 0; i < n; i++) {
          e.push([i, (i + 1) % n, false]);            // base edge
          e.push([n + i, n + ((i + 1) % n), false]);  // top edge
          e.push([i, n + i, false]);                  // vertical
        }
        return { vertices: v, edges: e, circles: [] };
      } else {
        v.push([0, 0, h]); // apex
        const apex = n;
        const e: Array<[number, number, boolean]> = [];
        for (let i = 0; i < n; i++) {
          e.push([i, (i + 1) % n, false]);
          e.push([i, apex, false]);
        }
        return { vertices: v, edges: e, circles: [] };
      }
    }
    case 'cylinder': {
      const R = spec.sizeMm / 2;
      const h = spec.axisMm ?? spec.sizeMm * 1.5;
      // Sample 36 points around each circle so the projector network is detailed enough.
      const N = 36;
      const base: Array<[number, number, number]> = [];
      const top: Array<[number, number, number]> = [];
      for (let i = 0; i < N; i++) {
        const a = (2 * Math.PI * i) / N;
        base.push([R * Math.cos(a), R * Math.sin(a), 0]);
        top.push([R * Math.cos(a), R * Math.sin(a), h]);
      }
      const v: Array<[number, number, number]> = [...base, ...top];
      const e: Array<[number, number, boolean]> = [];
      // Silhouette generator pair (two vertical lines at x = ±R approximately).
      const leftIdx = N / 2;
      const rightIdx = 0;
      e.push([rightIdx, rightIdx + N, false]);
      e.push([leftIdx, leftIdx + N, false]);
      return {
        vertices: v,
        edges: e,
        circles: [
          {
            centre: [0, 0, 0],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0],
            radius: R,
          },
          {
            centre: [0, 0, h],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0],
            radius: R,
          },
        ],
      };
    }
    case 'cone': {
      const R = spec.sizeMm / 2;
      const h = spec.axisMm ?? spec.sizeMm * 1.5;
      const N = 36;
      const base: Array<[number, number, number]> = [];
      for (let i = 0; i < N; i++) {
        const a = (2 * Math.PI * i) / N;
        base.push([R * Math.cos(a), R * Math.sin(a), 0]);
      }
      const apex: [number, number, number] = [0, 0, h];
      const v: Array<[number, number, number]> = [...base, apex];
      const e: Array<[number, number, boolean]> = [];
      const apexIdx = N;
      e.push([0, apexIdx, false]);
      e.push([N / 2, apexIdx, false]);
      return {
        vertices: v,
        edges: e,
        circles: [
          {
            centre: [0, 0, 0],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0],
            radius: R,
          },
        ],
      };
    }
  }
}

/* ----- Apply the requested pose to vertices and circle frames ----- */

function applyPose(shape: SolidShape3D, spec: SolidSpec): SolidShape3D {
  const v0 = shape.vertices;
  const out: SolidShape3D = {
    vertices: v0.map((p) => [...p] as [number, number, number]),
    edges: shape.edges.map((e) => [...e] as [number, number, boolean]),
    circles: shape.circles.map((c) => ({
      centre: [...c.centre] as [number, number, number],
      uAxis: [...c.uAxis] as [number, number, number],
      vAxis: [...c.vAxis] as [number, number, number],
      radius: c.radius,
    })),
  };

  const tilt = (axis: 'x' | 'y', deg: number) => {
    const a = deg2rad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const tx = (p: [number, number, number]): [number, number, number] => {
      if (axis === 'x') return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
      return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    };
    out.vertices = out.vertices.map(tx);
    out.circles = out.circles.map((cc) => ({
      ...cc,
      centre: tx(cc.centre),
      uAxis: tx(cc.uAxis),
      vAxis: tx(cc.vAxis),
    }));
  };

  switch (spec.pose) {
    case 'perpendicular-to-HP':
      // Axis is the Z axis already → nothing to do.
      break;
    case 'perpendicular-to-VP':
      // Axis along Y. Rotate model 90° about X so original Z lands on Y.
      tilt('x', 90);
      break;
    case 'parallel-to-both':
      // Axis along X. Rotate model 90° about Y so original Z lands on X.
      tilt('y', -90);
      break;
    case 'inclined-to-HP':
      tilt('x', spec.inclinationDeg ?? 30);
      break;
    case 'inclined-to-VP':
      tilt('y', -(spec.inclinationDeg ?? 30));
      break;
  }
  return out;
}

/* ----- Circle drawing in FV/TV ----- */

function drawCircleProjection(
  builder: StrokeBuilder,
  c: CircleFeature,
  _vertices: Array<[number, number, number]>,
  fv: (v: [number, number, number]) => Pt,
  tv: (v: [number, number, number]) => Pt
): void {
  const N = 48;
  const fvPts: Pt[] = [];
  const tvPts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i * 2 * Math.PI) / N;
    const x = c.centre[0] + c.radius * (Math.cos(t) * c.uAxis[0] + Math.sin(t) * c.vAxis[0]);
    const y = c.centre[1] + c.radius * (Math.cos(t) * c.uAxis[1] + Math.sin(t) * c.vAxis[1]);
    const z = c.centre[2] + c.radius * (Math.cos(t) * c.uAxis[2] + Math.sin(t) * c.vAxis[2]);
    fvPts.push(fv([x, y, z]));
    tvPts.push(tv([x, y, z]));
  }
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Front view: circular edge (drawn as the projected ellipse)',
    points: fvPts,
    closed: true,
    layer: 'final',
  });
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Top view: circular edge (drawn as the projected ellipse)',
    points: tvPts,
    closed: true,
    layer: 'final',
  });
  void ellipsePoints; // re-exported elsewhere
}

/* ----- Titles and summaries ----- */

function titleFor(spec: SolidSpec): string {
  const base = solidName(spec);
  return `Projections of a ${base} (${describePose(spec)})`;
}

function solidName(spec: SolidSpec): string {
  const baseName: Record<SolidShape, string> = {
    prism: prismOrPyramidName('prism', spec.sides ?? 6),
    pyramid: prismOrPyramidName('pyramid', spec.sides ?? 6),
    cube: 'cube',
    tetrahedron: 'tetrahedron',
    cylinder: 'cylinder',
    cone: 'cone',
  };
  const dims =
    spec.shape === 'cube'
      ? `, side ${fmt(spec.sizeMm)}mm`
      : spec.shape === 'tetrahedron'
      ? `, edge ${fmt(spec.sizeMm)}mm`
      : spec.shape === 'cylinder' || spec.shape === 'cone'
      ? `, Ø${fmt(spec.sizeMm)}mm, axis ${fmt(spec.axisMm ?? spec.sizeMm * 1.5)}mm`
      : `, base side ${fmt(spec.sizeMm)}mm, axis ${fmt(spec.axisMm ?? spec.sizeMm * 1.5)}mm`;
  return `${baseName[spec.shape]}${dims}`;
}

function prismOrPyramidName(kind: 'prism' | 'pyramid', n: number): string {
  const prefix =
    n === 3 ? 'triangular' :
    n === 4 ? 'square' :
    n === 5 ? 'pentagonal' :
    n === 6 ? 'hexagonal' :
    n === 7 ? 'heptagonal' :
    n === 8 ? 'octagonal' :
    `${n}-sided`;
  return `${prefix} ${kind}`;
}

function describePose(spec: SolidSpec): string {
  switch (spec.pose) {
    case 'perpendicular-to-HP':
      return 'axis ⟂ HP — resting on its base';
    case 'perpendicular-to-VP':
      return 'axis ⟂ VP — lying on its side against VP';
    case 'parallel-to-both':
      return 'axis parallel to both HP and VP';
    case 'inclined-to-HP':
      return `axis inclined ${spec.inclinationDeg ?? 30}° to HP`;
    case 'inclined-to-VP':
      return `axis inclined ${spec.inclinationDeg ?? 30}° to VP`;
  }
}

function summaryFor(spec: SolidSpec, vCount: number): string {
  const name = solidName(spec);
  const pose = describePose(spec);
  return `Projections of a ${name} with ${pose}. The solid has ${vCount} vertices in 3-D; each vertex projects vertically to the front view (height above XY = its Z coordinate) and to the top view (depth below XY = its Y coordinate). Edges that lie behind another face are drawn lighter as construction (hidden) lines.`;
}

/* re-export for parity */
export { rotateAbout };
