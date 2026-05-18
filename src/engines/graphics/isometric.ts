import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, pageCenterX, xyLineY } from './layout';

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
const SIN30 = Math.sin(Math.PI / 6); // = 0.5

interface Origin {
  x: number;
  y: number;
}

/**
 * Map 3D (x, y, z) to isometric paper coordinates.
 *  - Paper X grows right.
 *  - Paper Y grows DOWN.
 *  - 3D X axis goes 30° below horizontal to the right.
 *  - 3D Y axis goes 30° below horizontal to the left.
 *  - 3D Z axis goes straight up (negative paper-Y).
 */
function iso(o: Origin, x: number, y: number, z: number): Pt {
  return {
    x: o.x + (x - y) * COS30,
    y: o.y + (x + y) * SIN30 - z,
  };
}

export interface CubeSpec {
  sideMm: number;
}

export function buildIsoCube(spec: CubeSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const L = spec.sideMm;
  // Place the back-bottom corner so the cube sits centered on the page
  const o: Origin = { x: pageCenterX(), y: xyLineY() + L * 0.5 };

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Isometric Projection — Cube of side ${L}mm`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Vertices
  const v = (x: number, y: number, z: number) => iso(o, x, y, z);
  const v000 = v(0, 0, 0);
  const v100 = v(L, 0, 0);
  const v010 = v(0, L, 0);
  const v110 = v(L, L, 0);
  const v001 = v(0, 0, L);
  const v101 = v(L, 0, L);
  const v011 = v(0, L, L);
  const v111 = v(L, L, L);

  // Bottom face — usually hidden, draw lightly
  builder.line({
    tool: '2H Pencil',
    instruction: 'Bottom edge (back-right)',
    from: v000,
    to: v100,
    layer: 'construction',
  });
  builder.line({
    tool: '2H Pencil',
    instruction: 'Bottom edge (back-left)',
    from: v000,
    to: v010,
    layer: 'construction',
  });
  // Front-bottom edges (visible)
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Bottom edge (front-right)',
    from: v100,
    to: v110,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Bottom edge (front-left)',
    from: v010,
    to: v110,
    layer: 'final',
  });
  // Vertical edges
  builder.line({
    tool: 'Set Square',
    instruction: 'Front-vertical edge',
    from: v110,
    to: v111,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right-vertical edge',
    from: v100,
    to: v101,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Left-vertical edge',
    from: v010,
    to: v011,
    layer: 'final',
  });
  // Back vertical edge — hidden (use construction)
  builder.line({
    tool: '2H Pencil',
    instruction: 'Back-vertical edge (hidden)',
    from: v000,
    to: v001,
    layer: 'construction',
  });
  // Top face
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Top edge (right)',
    from: v101,
    to: v111,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Top edge (left)',
    from: v011,
    to: v111,
    layer: 'final',
  });
  // Top edges to back vertex (back-right and back-left of top)
  builder.line({
    tool: '2H Pencil',
    instruction: 'Top edge to back (hidden)',
    from: v001,
    to: v101,
    layer: 'construction',
  });
  builder.line({
    tool: '2H Pencil',
    instruction: 'Top edge to back (hidden)',
    from: v001,
    to: v011,
    layer: 'construction',
  });

  // Axes indicator (small)
  const axisOrigin = { x: 80, y: PAGE.heightMm - 80 };
  const axLen = 30;
  builder.arrow({
    tool: 'HB Pencil',
    instruction: 'Isometric X-axis indicator',
    from: axisOrigin,
    to: { x: axisOrigin.x + axLen * COS30, y: axisOrigin.y + axLen * SIN30 },
    headSize: 3,
  });
  builder.arrow({
    tool: 'HB Pencil',
    instruction: 'Isometric Y-axis indicator',
    from: axisOrigin,
    to: { x: axisOrigin.x - axLen * COS30, y: axisOrigin.y + axLen * SIN30 },
    headSize: 3,
  });
  builder.arrow({
    tool: 'HB Pencil',
    instruction: 'Isometric Z-axis indicator (vertical)',
    from: axisOrigin,
    to: { x: axisOrigin.x, y: axisOrigin.y - axLen },
    headSize: 3,
  });
  builder.text({
    instruction: 'Label X-axis',
    at: { x: axisOrigin.x + axLen * COS30 + 4, y: axisOrigin.y + axLen * SIN30 + 1 },
    text: 'X',
    fontSize: 4,
  });
  builder.text({
    instruction: 'Label Y-axis',
    at: { x: axisOrigin.x - axLen * COS30 - 4, y: axisOrigin.y + axLen * SIN30 + 1 },
    text: 'Y',
    align: 'end',
    fontSize: 4,
  });
  builder.text({
    instruction: 'Label Z-axis',
    at: { x: axisOrigin.x, y: axisOrigin.y - axLen - 3 },
    text: 'Z',
    align: 'middle',
    fontSize: 4,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Isometric projection of a cube of side ${L}mm. Three of the cube's edges meet at each visible corner at 120° to each other; the X- and Y-axes are drawn at 30° below the horizontal, and the Z-axis vertically. All edges are drawn at their true length (no foreshortening in this convention). Visible edges are darkened; hidden edges (back-bottom and back-top) are shown as construction lines.`,
  };
}

export interface CylinderSpec {
  diameterMm: number;
  heightMm: number;
}

export function buildIsoCylinder(spec: CylinderSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const D = spec.diameterMm;
  const R = D / 2;
  const H = spec.heightMm;
  const o: Origin = { x: pageCenterX(), y: xyLineY() + H / 2 + R };

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Isometric Projection — Cylinder D=${D}mm, H=${H}mm`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Sample N points around base/top ellipses
  const N = 36;
  const basePts: Pt[] = [];
  const topPts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i * 2 * Math.PI) / N;
    const x = R * Math.cos(theta);
    const y = R * Math.sin(theta);
    basePts.push(iso(o, x, y, 0));
    topPts.push(iso(o, x, y, H));
  }

  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Sketch the base ellipse',
    points: basePts,
    closed: true,
    layer: 'final',
  });
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Sketch the top ellipse',
    points: topPts,
    closed: true,
    layer: 'final',
  });

  // Tangent vertical edges. The leftmost and rightmost points of the base ellipse
  // (in screen-x) define the silhouette edges.
  let leftIdx = 0;
  let rightIdx = 0;
  for (let i = 0; i < basePts.length; i++) {
    if (basePts[i].x < basePts[leftIdx].x) leftIdx = i;
    if (basePts[i].x > basePts[rightIdx].x) rightIdx = i;
  }
  builder.line({
    tool: 'Set Square',
    instruction: 'Left silhouette edge of cylinder',
    from: basePts[leftIdx],
    to: topPts[leftIdx],
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right silhouette edge of cylinder',
    from: basePts[rightIdx],
    to: topPts[rightIdx],
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Isometric projection of a cylinder with diameter ${D}mm and height ${H}mm. The circular base and top each project to an ellipse in isometric (because the viewing direction is oblique to the circle plane). The major axis of each ellipse aligns with the screen-horizontal; the minor axis is along the receding diagonal. The silhouette is completed with two vertical lines tangent to both ellipses on the left and right.`,
  };
}

export interface ConeSpec {
  baseDiameterMm: number;
  heightMm: number;
}

export function buildIsoCone(spec: ConeSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const D = spec.baseDiameterMm;
  const R = D / 2;
  const H = spec.heightMm;
  const o: Origin = { x: pageCenterX(), y: xyLineY() + H / 2 + R };

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Isometric Projection — Cone D=${D}mm, H=${H}mm`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Base ellipse
  const N = 36;
  const basePts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i * 2 * Math.PI) / N;
    const x = R * Math.cos(theta);
    const y = R * Math.sin(theta);
    basePts.push(iso(o, x, y, 0));
  }
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Sketch the base ellipse',
    points: basePts,
    closed: true,
    layer: 'final',
  });

  // Apex
  const apex = iso(o, 0, 0, H);

  // Tangent slant lines
  let leftIdx = 0;
  let rightIdx = 0;
  for (let i = 0; i < basePts.length; i++) {
    if (basePts[i].x < basePts[leftIdx].x) leftIdx = i;
    if (basePts[i].x > basePts[rightIdx].x) rightIdx = i;
  }
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Left slant edge to apex',
    from: basePts[leftIdx],
    to: apex,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Right slant edge to apex',
    from: basePts[rightIdx],
    to: apex,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Isometric projection of a cone with base diameter ${D}mm and height ${H}mm. The circular base projects to an ellipse; the apex sits directly above the base center at the cone's full height. The two slant lines are tangent to the base ellipse at its leftmost and rightmost screen-x points and meet at the apex.`,
  };
}
