import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, drawTitle, drawXYReference, xyLineY, pageCenterX } from './layout';
import {
  deg2rad,
  ellipsePoints,
  fmt,
  regularPolygon,
  rotateAbout,
} from './geometry';

export type PlaneShape = 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'circle';

export type PlaneOrientation =
  | 'parallel-to-HP'
  | 'parallel-to-VP'
  | 'inclined-to-HP'
  | 'inclined-to-VP';

export interface PlaneSpec {
  shape: PlaneShape;
  /** Edge / side length in mm (for polygons). For a circle, this is the diameter. */
  sizeMm: number;
  orientation: PlaneOrientation;
  /** Inclination angle in degrees (only used when orientation is 'inclined-to-*'). */
  inclinationDeg?: number;
}

interface PlaneResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

const SHAPE_LABEL: Record<PlaneShape, string> = {
  triangle: 'Equilateral triangle',
  square: 'Square',
  pentagon: 'Regular pentagon',
  hexagon: 'Regular hexagon',
  circle: 'Circle',
};

const N_SIDES: Record<Exclude<PlaneShape, 'circle'>, number> = {
  triangle: 3,
  square: 4,
  pentagon: 5,
  hexagon: 6,
};

function buildTrueShape(spec: PlaneSpec, centre: Pt): Pt[] {
  if (spec.shape === 'circle') {
    const r = spec.sizeMm / 2;
    return ellipsePoints(centre, r, r, 60);
  }
  const n = N_SIDES[spec.shape];
  const r = spec.sizeMm / (2 * Math.sin(Math.PI / n));
  // Pick a friendly starting angle per shape (screen-y grows down).
  let start = -Math.PI / 2;
  if (n === 3) start = -Math.PI / 2; // apex up, flat side at bottom
  if (n === 4) start = -Math.PI / 4; // square sits flat on a side
  if (n === 5) start = -Math.PI / 2; // apex up
  if (n === 6) start = 0; // flat-topped hexagon
  return regularPolygon(centre, r, n, start);
}

export function buildPlaneProjection(spec: PlaneSpec): PlaneResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const xy = xyLineY();
  const cx = pageCenterX();

  drawTitle(
    builder,
    `Projections of a ${SHAPE_LABEL[spec.shape]} (${describeOrientation(spec)})`
  );
  drawXYReference(builder);

  const tvCentre: Pt = { x: cx, y: xy + 70 };
  const fvCentre: Pt = { x: cx, y: xy - 70 };

  switch (spec.orientation) {
    case 'parallel-to-HP':
      return planeParallelToHP(spec, builder, tvCentre, paper);
    case 'parallel-to-VP':
      return planeParallelToVP(spec, builder, fvCentre, paper);
    case 'inclined-to-HP':
      return planeInclinedToHP(spec, builder, tvCentre, paper);
    case 'inclined-to-VP':
      return planeInclinedToVP(spec, builder, fvCentre, paper);
  }
}

/* ----- Case 1: plane parallel to HP (lying flat on HP) ----- */
function planeParallelToHP(
  spec: PlaneSpec,
  builder: StrokeBuilder,
  tvCentre: Pt,
  paper: PaperSpec
): PlaneResult {
  const trueShape = buildTrueShape(spec, tvCentre);

  builder.curve({
    tool: 'HB Pencil',
    instruction: `Draw the top view: ${SHAPE_LABEL[spec.shape]} of ${
      spec.shape === 'circle' ? 'diameter' : 'side'
    } ${spec.sizeMm}mm (true shape on HP)`,
    points: trueShape,
    closed: true,
    layer: 'final',
  });

  const xs = trueShape.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  builder.line({
    tool: 'HB Pencil',
    instruction: 'Draw the front view as a horizontal line on XY (plane parallel to HP ⇒ FV degenerates)',
    from: { x: minX, y: xyLineY() },
    to: { x: maxX, y: xyLineY() },
    layer: 'final',
  });

  drawProjectors(builder, trueShape, xyLineY());
  dimensionLabel(builder, spec, minX, maxX);

  return {
    strokes: builder.build(),
    paper,
    summary: `The ${SHAPE_LABEL[spec.shape].toLowerCase()} lies parallel to (resting on) HP. The top view is the true shape; the front view collapses to a horizontal line on XY whose length equals the widest horizontal dimension of the top view.`,
  };
}

/* ----- Case 2: plane parallel to VP (against VP) ----- */
function planeParallelToVP(
  spec: PlaneSpec,
  builder: StrokeBuilder,
  fvCentre: Pt,
  paper: PaperSpec
): PlaneResult {
  const trueShape = buildTrueShape(spec, fvCentre);

  builder.curve({
    tool: 'HB Pencil',
    instruction: `Draw the front view: ${SHAPE_LABEL[spec.shape]} of ${
      spec.shape === 'circle' ? 'diameter' : 'side'
    } ${spec.sizeMm}mm (true shape on VP)`,
    points: trueShape,
    closed: true,
    layer: 'final',
  });

  const xs = trueShape.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  builder.line({
    tool: 'HB Pencil',
    instruction: 'Draw the top view as a horizontal line on XY (plane parallel to VP ⇒ TV degenerates)',
    from: { x: minX, y: xyLineY() },
    to: { x: maxX, y: xyLineY() },
    layer: 'final',
  });

  drawProjectors(builder, trueShape, xyLineY());
  dimensionLabel(builder, spec, minX, maxX);

  return {
    strokes: builder.build(),
    paper,
    summary: `The ${SHAPE_LABEL[spec.shape].toLowerCase()} lies parallel to (against) VP. The front view is the true shape; the top view collapses to a horizontal line on XY equal to the widest horizontal dimension of the front view.`,
  };
}

/* ----- Case 3: plane inclined to HP, perpendicular to VP ----- */
function planeInclinedToHP(
  spec: PlaneSpec,
  builder: StrokeBuilder,
  tvCentre: Pt,
  paper: PaperSpec
): PlaneResult {
  const inclDeg = spec.inclinationDeg ?? 30;
  const incl = deg2rad(inclDeg);

  // Stage 1 — assume parallel to HP, draw the true-shape TV and the line FV on XY.
  const stage1 = buildTrueShape(spec, tvCentre);
  builder.curve({
    tool: '2H Pencil',
    instruction: 'Stage 1: assume the plane is parallel to HP — top view is the true shape',
    points: stage1,
    closed: true,
    layer: 'construction',
  });
  const minX = Math.min(...stage1.map((p) => p.x));
  const maxX = Math.max(...stage1.map((p) => p.x));
  builder.line({
    tool: '2H Pencil',
    instruction: 'Stage 1: front view is a horizontal line on XY',
    from: { x: minX, y: xyLineY() },
    to: { x: maxX, y: xyLineY() },
    layer: 'construction',
  });

  // Stage 2 — rotate the FV line about its leftmost endpoint by inclination upward.
  const pivot: Pt = { x: minX, y: xyLineY() };
  const fvRight: Pt = { x: maxX, y: xyLineY() };
  const fvRightTilted = rotateAbout(fvRight, pivot, -incl);
  builder.line({
    tool: 'HB Pencil',
    instruction: `Stage 2: tilt the front-view line through ${inclDeg}° to XY (line is the FV of the inclined plane)`,
    from: pivot,
    to: fvRightTilted,
    layer: 'final',
  });

  // The new TV: each stage-1 vertex projects vertically from the inclined FV line.
  const stage2Tv: Pt[] = stage1.map((p) => {
    const t = maxX === minX ? 0 : (p.x - minX) / (maxX - minX);
    const fvOnTiltedX = pivot.x + (fvRightTilted.x - pivot.x) * t;
    return { x: fvOnTiltedX, y: p.y };
  });
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Stage 2: redraw the top view using new (foreshortened) x positions read off from the inclined FV',
    points: stage2Tv,
    closed: true,
    layer: 'final',
  });

  // Projectors stage-2
  for (let i = 0; i < stage1.length; i++) {
    const t = maxX === minX ? 0 : (stage1[i].x - minX) / (maxX - minX);
    const fvOnTilted: Pt = {
      x: pivot.x + (fvRightTilted.x - pivot.x) * t,
      y: pivot.y + (fvRightTilted.y - pivot.y) * t,
    };
    builder.line({
      tool: '2H Pencil',
      instruction: `Projector from FV vertex ${i + 1} to TV`,
      from: fvOnTilted,
      to: stage2Tv[i],
      layer: 'construction',
    });
  }

  return {
    strokes: builder.build(),
    paper,
    summary: `The ${SHAPE_LABEL[spec.shape].toLowerCase()} is inclined ${inclDeg}° to HP and perpendicular to VP. Stage 1 (construction): assume the surface lies on HP — the top view shows the true shape and the front view is a horizontal line on XY. Stage 2 (final): tilt the FV line about one edge through ${inclDeg}°. Project each FV vertex vertically down to obtain the new (foreshortened) TV. The FV is now a single inclined line; the TV is a shrunken version of the true shape.`,
  };
}

/* ----- Case 4: plane inclined to VP, perpendicular to HP ----- */
function planeInclinedToVP(
  spec: PlaneSpec,
  builder: StrokeBuilder,
  fvCentre: Pt,
  paper: PaperSpec
): PlaneResult {
  const inclDeg = spec.inclinationDeg ?? 30;
  const incl = deg2rad(inclDeg);

  // Stage 1 — assume parallel to VP, draw the true-shape FV and the line TV on XY.
  const stage1 = buildTrueShape(spec, fvCentre);
  builder.curve({
    tool: '2H Pencil',
    instruction: 'Stage 1: assume the plane is parallel to VP — front view is the true shape',
    points: stage1,
    closed: true,
    layer: 'construction',
  });
  const minX = Math.min(...stage1.map((p) => p.x));
  const maxX = Math.max(...stage1.map((p) => p.x));
  builder.line({
    tool: '2H Pencil',
    instruction: 'Stage 1: top view is a horizontal line on XY',
    from: { x: minX, y: xyLineY() },
    to: { x: maxX, y: xyLineY() },
    layer: 'construction',
  });

  const pivot: Pt = { x: minX, y: xyLineY() };
  const tvRight: Pt = { x: maxX, y: xyLineY() };
  const tvRightTilted = rotateAbout(tvRight, pivot, incl); // rotates downward in screen coords
  builder.line({
    tool: 'HB Pencil',
    instruction: `Stage 2: tilt the top-view line through ${inclDeg}° to XY (this is the TV of the inclined plane)`,
    from: pivot,
    to: tvRightTilted,
    layer: 'final',
  });

  const stage2Fv: Pt[] = stage1.map((p) => {
    const t = maxX === minX ? 0 : (p.x - minX) / (maxX - minX);
    const tvOnTiltedX = pivot.x + (tvRightTilted.x - pivot.x) * t;
    return { x: tvOnTiltedX, y: p.y };
  });
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Stage 2: redraw the front view using new x positions read off from the inclined TV',
    points: stage2Fv,
    closed: true,
    layer: 'final',
  });

  for (let i = 0; i < stage1.length; i++) {
    const t = maxX === minX ? 0 : (stage1[i].x - minX) / (maxX - minX);
    const tvOnTilted: Pt = {
      x: pivot.x + (tvRightTilted.x - pivot.x) * t,
      y: pivot.y + (tvRightTilted.y - pivot.y) * t,
    };
    builder.line({
      tool: '2H Pencil',
      instruction: `Projector from TV vertex ${i + 1} to FV`,
      from: stage2Fv[i],
      to: tvOnTilted,
      layer: 'construction',
    });
  }

  return {
    strokes: builder.build(),
    paper,
    summary: `The ${SHAPE_LABEL[spec.shape].toLowerCase()} is inclined ${inclDeg}° to VP and perpendicular to HP. Stage 1: assume the surface is parallel to VP — the FV shows the true shape and the TV is a horizontal line on XY. Stage 2: tilt the TV line about one corner through ${inclDeg}°. Project each TV vertex vertically up to obtain the new foreshortened FV. The TV is now a single inclined line; the FV is a shrunken version of the true shape.`,
  };
}

function drawProjectors(builder: StrokeBuilder, pts: Pt[], xyY: number): void {
  for (const p of pts) {
    if (Math.abs(p.y - xyY) < 0.5) continue;
    builder.line({
      tool: '2H Pencil',
      instruction: 'Vertical projector to XY',
      from: { x: p.x, y: Math.min(p.y, xyY) },
      to: { x: p.x, y: Math.max(p.y, xyY) },
      layer: 'construction',
    });
  }
}

function dimensionLabel(builder: StrokeBuilder, spec: PlaneSpec, minX: number, maxX: number): void {
  builder.text({
    instruction: 'Dimension annotation',
    at: { x: (minX + maxX) / 2, y: PAGE.heightMm - 30 },
    text: `${spec.shape === 'circle' ? 'Ø' : ''}${fmt(spec.sizeMm)}mm`,
    align: 'middle',
    fontSize: 4.5,
  });
}

function describeOrientation(spec: PlaneSpec): string {
  switch (spec.orientation) {
    case 'parallel-to-HP':
      return 'parallel to HP';
    case 'parallel-to-VP':
      return 'parallel to VP';
    case 'inclined-to-HP':
      return `inclined ${spec.inclinationDeg ?? 30}° to HP, ⟂ VP`;
    case 'inclined-to-VP':
      return `inclined ${spec.inclinationDeg ?? 30}° to VP, ⟂ HP`;
  }
}
