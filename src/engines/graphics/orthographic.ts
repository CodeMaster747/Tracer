import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { drawTitle, xyLineY, pageCenterX } from './layout';
import { deg2rad, fmt } from './geometry';

/**
 * Generate three orthographic views (Front, Top, Side) of a simple rectangular block
 * with an optional cutout, in first- or third-angle projection.
 */
export interface BlockSpec {
  /** Width (along X), depth (along Y), height (along Z) in mm. */
  width: number;
  depth: number;
  height: number;
  /** Optional rectangular cutout going through the full depth at the top. */
  cutout?: { widthMm: number; depthMm: number; heightMm: number };
  /** First or third angle. */
  angle: 'first' | 'third';
}

interface OrthoResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

export function buildOrthographicBlock(spec: BlockSpec): OrthoResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(
    builder,
    `Orthographic Views of a Block (${fmt(spec.width)}×${fmt(spec.depth)}×${fmt(spec.height)}mm, ${
      spec.angle === 'first' ? '1st' : '3rd'
    }-angle)`
  );

  // Layout: in first-angle, FV is top-left, TV below FV, RHSV right of FV.
  //   In third-angle, FV is bottom-left, TV above FV, RHSV right of FV.
  const cx = pageCenterX();
  const xy = xyLineY();

  const fvOrigin: Pt = { x: cx - spec.width - 30, y: spec.angle === 'first' ? xy - 50 : xy + 50 + spec.height };
  const tvOrigin: Pt = { x: fvOrigin.x, y: spec.angle === 'first' ? xy + 50 : xy - 50 - spec.depth };
  const svOrigin: Pt = { x: fvOrigin.x + spec.width + 40, y: fvOrigin.y };

  drawFV(builder, spec, fvOrigin);
  drawTV(builder, spec, tvOrigin);
  drawSV(builder, spec, svOrigin);

  // XY line
  builder.line({
    tool: 'T-Square',
    instruction: 'Reference XY line between FV and TV',
    from: { x: fvOrigin.x - 20, y: xy },
    to: { x: svOrigin.x + spec.height + 20, y: xy },
    layer: 'construction',
  });

  // Labels
  builder.text({
    instruction: 'FV label',
    at: { x: fvOrigin.x + spec.width / 2, y: fvOrigin.y - 6 },
    text: 'FRONT VIEW',
    align: 'middle',
    fontSize: 4.5,
  });
  builder.text({
    instruction: 'TV label',
    at: { x: tvOrigin.x + spec.width / 2, y: tvOrigin.y + spec.depth + 8 },
    text: 'TOP VIEW',
    align: 'middle',
    fontSize: 4.5,
  });
  builder.text({
    instruction: 'SV label',
    at: { x: svOrigin.x + spec.height / 2, y: svOrigin.y - 6 },
    text: 'RIGHT SIDE VIEW',
    align: 'middle',
    fontSize: 4.5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Three orthographic views of a rectangular block ${fmt(spec.width)}×${fmt(
      spec.depth
    )}×${fmt(spec.height)}mm${
      spec.cutout
        ? ` with a ${fmt(spec.cutout.widthMm)}×${fmt(spec.cutout.depthMm)}×${fmt(spec.cutout.heightMm)}mm rectangular cutout at the top`
        : ''
    } in ${spec.angle === 'first' ? 'first' : 'third'}-angle projection. ${
      spec.angle === 'first'
        ? 'Front view sits above XY, top view below; right side view to the right.'
        : 'Front view sits below XY, top view above; right side view to the right.'
    } Hidden cutout edges are drawn as construction lines.`,
  };
}

function drawFV(builder: StrokeBuilder, spec: BlockSpec, o: Pt): void {
  rect(builder, o, spec.width, spec.height, 'FV outline');
  if (spec.cutout) {
    const cx = o.x + (spec.width - spec.cutout.widthMm) / 2;
    const cy = o.y; // sits at top
    rect(builder, { x: cx, y: cy }, spec.cutout.widthMm, spec.cutout.heightMm, 'FV cutout');
  }
}
function drawTV(builder: StrokeBuilder, spec: BlockSpec, o: Pt): void {
  rect(builder, o, spec.width, spec.depth, 'TV outline');
  if (spec.cutout) {
    const cx = o.x + (spec.width - spec.cutout.widthMm) / 2;
    rect(builder, { x: cx, y: o.y }, spec.cutout.widthMm, spec.cutout.depthMm, 'TV cutout');
  }
}
function drawSV(builder: StrokeBuilder, spec: BlockSpec, o: Pt): void {
  // Right side view dimensions: depth × height
  rect(builder, o, spec.depth, spec.height, 'SV outline');
  if (spec.cutout) {
    const cx = o.x + (spec.depth - spec.cutout.depthMm) / 2;
    const cy = o.y;
    rect(builder, { x: cx, y: cy }, spec.cutout.depthMm, spec.cutout.heightMm, 'SV cutout');
  }
}

function rect(builder: StrokeBuilder, origin: Pt, w: number, h: number, _name: string): void {
  const a = origin;
  const b: Pt = { x: origin.x + w, y: origin.y };
  const c: Pt = { x: origin.x + w, y: origin.y + h };
  const d: Pt = { x: origin.x, y: origin.y + h };
  builder.line({
    tool: 'T-Square',
    instruction: 'Top edge',
    from: a,
    to: b,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right edge',
    from: b,
    to: c,
    layer: 'final',
  });
  builder.line({
    tool: 'T-Square',
    instruction: 'Bottom edge',
    from: c,
    to: d,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Left edge',
    from: d,
    to: a,
    layer: 'final',
  });
}

/* ============================================================ *
 *  Auxiliary view of an inclined face on a wedge-like solid.
 * ============================================================ */

export interface AuxiliaryViewSpec {
  /** Width, depth, height of the bounding box. */
  width: number;
  depth: number;
  height: number;
  /** Inclination angle of the inclined face to HP (degrees). */
  faceInclinationDeg: number;
}

export function buildAuxiliaryView(spec: AuxiliaryViewSpec): OrthoResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(
    builder,
    `Auxiliary View of Inclined Face (face tilted ${spec.faceInclinationDeg}° to HP)`
  );

  const cx = pageCenterX();
  const xy = xyLineY();

  // FV (a right trapezoid with the inclined face on the left)
  const fvOrigin: Pt = { x: cx - 150, y: xy - 50 };
  const base: Pt = { x: fvOrigin.x, y: fvOrigin.y };
  const baseR: Pt = { x: fvOrigin.x + spec.width, y: fvOrigin.y };
  const topR: Pt = { x: fvOrigin.x + spec.width, y: fvOrigin.y - spec.height };
  const inclineLen = spec.height / Math.sin(deg2rad(spec.faceInclinationDeg));
  const topL: Pt = {
    x: base.x + inclineLen * Math.cos(deg2rad(spec.faceInclinationDeg)),
    y: base.y - inclineLen * Math.sin(deg2rad(spec.faceInclinationDeg)),
  };

  builder.line({
    tool: 'T-Square',
    instruction: 'FV: base',
    from: base,
    to: baseR,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'FV: right vertical edge',
    from: baseR,
    to: topR,
    layer: 'final',
  });
  builder.line({
    tool: 'T-Square',
    instruction: 'FV: top edge',
    from: topR,
    to: topL,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: `FV: inclined face (${spec.faceInclinationDeg}° to HP)`,
    from: topL,
    to: base,
    layer: 'final',
  });

  // TV: rectangle below the FV
  const tvOrigin: Pt = { x: fvOrigin.x, y: xy + 20 };
  rect(builder, tvOrigin, spec.width, spec.depth, 'TV');

  // AUXILIARY view perpendicular to the inclined face. We project each FV vertex along the
  // direction normal to the inclined face. The depth (perpendicular to FV) of each point
  // is read from the TV.
  const auxOrigin: Pt = { x: fvOrigin.x + 220, y: xy - 70 };
  // Normal direction to incline: along (sin α, -cos α) i.e. "left-up" relative to incline
  const alpha = deg2rad(spec.faceInclinationDeg);
  const nx = Math.sin(alpha);
  const ny = -Math.cos(alpha);
  // Along-incline direction
  const tx = -ny;
  const ty = nx;

  // Auxiliary projection of the four corners of the inclined face: base, topL, topL+depth, base+depth
  // Width of inclined face on the page = inclineLen, depth = spec.depth
  const incLen = Math.hypot(topL.x - base.x, topL.y - base.y);
  const aux1 = auxOrigin;
  const aux2: Pt = { x: auxOrigin.x + incLen * tx, y: auxOrigin.y + incLen * ty };
  const aux3: Pt = { x: aux2.x + spec.depth * nx, y: aux2.y + spec.depth * ny };
  const aux4: Pt = { x: auxOrigin.x + spec.depth * nx, y: auxOrigin.y + spec.depth * ny };

  builder.line({
    tool: 'HB Pencil',
    instruction: 'Auxiliary view: edge 1',
    from: aux1,
    to: aux2,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Auxiliary view: edge 2',
    from: aux2,
    to: aux3,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Auxiliary view: edge 3',
    from: aux3,
    to: aux4,
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Auxiliary view: edge 4',
    from: aux4,
    to: aux1,
    layer: 'final',
  });

  // Projector lines between FV inclined edge and the auxiliary view
  builder.line({
    tool: '2H Pencil',
    instruction: 'Projector from FV top-left to auxiliary view',
    from: topL,
    to: aux2,
    layer: 'construction',
  });
  builder.line({
    tool: '2H Pencil',
    instruction: 'Projector from FV base-left to auxiliary view',
    from: base,
    to: aux1,
    layer: 'construction',
  });

  // Labels
  builder.text({
    instruction: 'FV label',
    at: { x: (base.x + baseR.x) / 2, y: base.y + 6 },
    text: 'FRONT VIEW',
    align: 'middle',
    fontSize: 4.5,
  });
  builder.text({
    instruction: 'TV label',
    at: { x: tvOrigin.x + spec.width / 2, y: tvOrigin.y + spec.depth + 6 },
    text: 'TOP VIEW',
    align: 'middle',
    fontSize: 4.5,
  });
  builder.text({
    instruction: 'Auxiliary label',
    at: { x: (aux1.x + aux3.x) / 2, y: (aux1.y + aux3.y) / 2 - 8 },
    text: 'TRUE SHAPE / AUXILIARY VIEW',
    align: 'middle',
    fontSize: 4.5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Auxiliary view drawn perpendicular to a face inclined ${
      spec.faceInclinationDeg
    }° to HP. Start by drawing the front view (a right trapezoid with the inclined face) and the top view. To get the TRUE SHAPE of the inclined face, set up an auxiliary projection plane parallel to the inclined face: project each vertex of the inclined face perpendicular to the FV's inclined edge, transferring depth from the top view. The auxiliary view is the true (un-foreshortened) outline of the inclined face — here a rectangle of size ${fmt(
      incLen
    )}mm × ${fmt(spec.depth)}mm.`,
  };
}
