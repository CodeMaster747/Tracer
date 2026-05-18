import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, pageCenterX, xyLineY, firstAnglePoint, thirdAnglePoint } from './layout';
import { deg2rad, fmt } from './geometry';
import type { ProjectionAngle } from './point';

export interface LineEndpoint {
  /** Above HP (signed mm, +above) */
  hp: number;
  /** In front of VP (signed mm, +in front) */
  vp: number;
}

export interface LineSpec {
  name: string;
  a: LineEndpoint;
  b: LineEndpoint;
  /** Horizontal distance between endpoints along XY axis (mm). If absent, computed from "true length" of the projections. */
  spanMm?: number;
}

export interface LineProjectionResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

export function buildLineProjection(line: LineSpec, angle: ProjectionAngle = 'first'): LineProjectionResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const xy = xyLineY();
  const cx = pageCenterX();
  const span = line.spanMm ?? 80;
  const xA = cx - span / 2;
  const xB = cx + span / 2;

  // Title
  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Line ${line.name}: ${formatEnd(line.a, 'A')}, ${formatEnd(line.b, 'B')} (${
      angle === 'first' ? '1st' : '3rd'
    }-angle)`,
    align: 'middle',
    fontSize: 6,
  });

  // XY line
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the reference line XY',
    from: { x: 50, y: xy },
    to: { x: PAGE.widthMm - 50, y: xy },
    layer: 'final',
  });
  builder.text({
    instruction: 'Label X',
    at: { x: 45, y: xy + 1 },
    text: 'X',
    align: 'end',
    baseline: 'middle',
    fontSize: 5,
  });
  builder.text({
    instruction: 'Label Y',
    at: { x: PAGE.widthMm - 45, y: xy + 1 },
    text: 'Y',
    align: 'start',
    baseline: 'middle',
    fontSize: 5,
  });

  // Compute projected positions for A and B
  const fnProj = angle === 'first' ? firstAnglePoint : thirdAnglePoint;
  const A = fnProj(xA, line.a.hp, line.a.vp);
  const B = fnProj(xB, line.b.hp, line.b.vp);

  // Draw front views and connecting line
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Plot front view a' for end A (${Math.abs(line.a.hp)}mm ${line.a.hp >= 0 ? 'above' : 'below'} HP)`,
    center: A.front,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: "Label a'",
    at: { x: A.front.x - 4, y: A.front.y },
    text: "a'",
    align: 'end',
    baseline: 'middle',
    fontSize: 4.5,
  });
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Plot front view b' for end B (${Math.abs(line.b.hp)}mm ${line.b.hp >= 0 ? 'above' : 'below'} HP)`,
    center: B.front,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: "Label b'",
    at: { x: B.front.x + 4, y: B.front.y },
    text: "b'",
    align: 'start',
    baseline: 'middle',
    fontSize: 4.5,
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: "Connect a' and b' (front view of line)",
    from: A.front,
    to: B.front,
    layer: 'final',
  });

  // Draw top views and connecting line
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Plot top view a for end A (${Math.abs(line.a.vp)}mm ${line.a.vp >= 0 ? 'in front of' : 'behind'} VP)`,
    center: A.top,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: 'Label a',
    at: { x: A.top.x - 4, y: A.top.y },
    text: 'a',
    align: 'end',
    baseline: 'middle',
    fontSize: 4.5,
  });
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Plot top view b for end B (${Math.abs(line.b.vp)}mm ${line.b.vp >= 0 ? 'in front of' : 'behind'} VP)`,
    center: B.top,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: 'Label b',
    at: { x: B.top.x + 4, y: B.top.y },
    text: 'b',
    align: 'start',
    baseline: 'middle',
    fontSize: 4.5,
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Connect a and b (top view of line)',
    from: A.top,
    to: B.top,
    layer: 'final',
  });

  // Projectors
  builder.line({
    tool: '2H Pencil',
    instruction: "Vertical projector at A connecting a and a'",
    from: { x: xA, y: Math.min(A.front.y, A.top.y) },
    to: { x: xA, y: Math.max(A.front.y, A.top.y) },
    layer: 'construction',
  });
  builder.line({
    tool: '2H Pencil',
    instruction: "Vertical projector at B connecting b and b'",
    from: { x: xB, y: Math.min(B.front.y, B.top.y) },
    to: { x: xB, y: Math.max(B.front.y, B.top.y) },
    layer: 'construction',
  });

  // True length annotation if line is parallel to either plane
  const trueLengthNote = computeTrueLengthNote(line);

  const summary = [
    `Line ${line.name} runs from end A (${Math.abs(line.a.hp)}mm ${
      line.a.hp >= 0 ? 'above' : 'below'
    } HP, ${Math.abs(line.a.vp)}mm ${line.a.vp >= 0 ? 'in front of' : 'behind'} VP) to end B (${Math.abs(
      line.b.hp
    )}mm ${line.b.hp >= 0 ? 'above' : 'below'} HP, ${Math.abs(line.b.vp)}mm ${
      line.b.vp >= 0 ? 'in front of' : 'behind'
    } VP).`,
    `Each endpoint produces a top view (on HP) and a front view (on VP). The two front-view points are joined to give the front view of the line, and similarly for the top view. Vertical projectors at each endpoint connect the two views.`,
    trueLengthNote,
  ].join(' ');

  return { strokes: builder.build(), paper, summary };
}

function formatEnd(e: LineEndpoint, name: string): string {
  return `${name}=(${Math.abs(e.hp)}${e.hp < 0 ? '↓' : '↑'}HP, ${Math.abs(e.vp)}${e.vp < 0 ? '↶' : '↷'}VP)`;
}

function computeTrueLengthNote(line: LineSpec): string {
  const sameHp = line.a.hp === line.b.hp;
  const sameVp = line.a.vp === line.b.vp;
  if (sameHp && sameVp) return 'The line is parallel to both HP and VP — both views show the true length.';
  if (sameHp) return 'The line is parallel to HP — its top view shows the true length and the true inclination to VP. The front view is parallel to XY.';
  if (sameVp) return 'The line is parallel to VP — its front view shows the true length and the true inclination to HP. The top view is parallel to XY.';
  return 'The line is inclined to both HP and VP — neither view shows the true length directly. Use the rotation or trapezoidal method to find true length and true inclinations.';
}

/* ============================================================ *
 *  Advanced: line specified by length and inclinations to HP/VP
 * ============================================================ */

export interface InclinedLineSpec {
  name: string;
  /** True length of the line in mm. */
  lengthMm: number;
  /** Inclination to HP (degrees). 0 means parallel to HP. */
  hpAngleDeg?: number;
  /** Inclination to VP (degrees). 0 means parallel to VP. */
  vpAngleDeg?: number;
  /** End A height above HP in mm. */
  aHpMm?: number;
  /** End A distance in front of VP in mm. */
  aVpMm?: number;
}

/**
 * Build projections of a line specified by its true length and inclinations.
 * Uses the trapezoid (rotation) method when both angles are given.
 *
 * Geometry:
 *   3D direction unit vector of the line:
 *      let θ = inclination to HP, φ = inclination to VP.
 *      sinθ = vertical-rise/length, sinφ = depth-rise/length.
 *      The horizontal (XY-plane) component magnitude is √(cos²θ − sin²φ) = √(1 − sin²θ − sin²φ).
 *      For this to be real we need sin²θ + sin²φ ≤ 1, i.e. θ + φ ≤ 90°.
 *
 *   With end A at (xA, aVp, aHp) and B = A + L·(dx, dy, dz):
 *      dz = L·sinθ          (height gain)
 *      dy = L·sinφ          (depth gain into VP)
 *      dx = √(L² − dz² − dy²)  (along XY)
 */
export function buildInclinedLineProjection(
  spec: InclinedLineSpec,
  angle: ProjectionAngle = 'first'
): { strokes: Stroke[]; paper: PaperSpec; summary: string } {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const xy = xyLineY();
  const L = spec.lengthMm;
  const theta = deg2rad(spec.hpAngleDeg ?? 0);
  const phi = deg2rad(spec.vpAngleDeg ?? 0);

  const dz = L * Math.sin(theta);
  const dy = L * Math.sin(phi);
  const dxSq = L * L - dz * dz - dy * dy;
  if (dxSq < -1e-6) {
    throw new Error(
      `Inclinations to HP (${spec.hpAngleDeg ?? 0}°) and VP (${spec.vpAngleDeg ?? 0}°) cannot both be that large — their squared sines sum to more than 1.`
    );
  }
  const dx = Math.sqrt(Math.max(dxSq, 0));

  const aHp = spec.aHpMm ?? 10;
  const aVp = spec.aVpMm ?? 10;
  const xA = pageCenterX() - dx / 2;
  const xB = xA + dx;

  const proj = angle === 'first' ? firstAnglePoint : thirdAnglePoint;
  const A = proj(xA, aHp, aVp);
  const B = proj(xB, aHp + dz, aVp + dy);

  // Title
  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Line ${spec.name} — length ${fmt(L)}mm, θ_HP=${spec.hpAngleDeg ?? 0}°, θ_VP=${spec.vpAngleDeg ?? 0}° (${
      angle === 'first' ? '1st' : '3rd'
    }-angle)`,
    align: 'middle',
    fontSize: 6,
  });

  // XY line
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the reference line XY',
    from: { x: 50, y: xy },
    to: { x: PAGE.widthMm - 50, y: xy },
    layer: 'final',
  });

  // Front view a'b' and top view ab
  drawEndpoint(builder, A.front, "a'", 'left');
  drawEndpoint(builder, B.front, "b'", 'right');
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Front view a′b′',
    from: A.front,
    to: B.front,
    layer: 'final',
  });
  drawEndpoint(builder, A.top, 'a', 'left');
  drawEndpoint(builder, B.top, 'b', 'right');
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Top view ab',
    from: A.top,
    to: B.top,
    layer: 'final',
  });

  // Projectors
  builder.line({
    tool: '2H Pencil',
    instruction: "Vertical projector at A",
    from: { x: xA, y: Math.min(A.front.y, A.top.y) },
    to: { x: xA, y: Math.max(A.front.y, A.top.y) },
    layer: 'construction',
  });
  builder.line({
    tool: '2H Pencil',
    instruction: "Vertical projector at B",
    from: { x: xB, y: Math.min(B.front.y, B.top.y) },
    to: { x: xB, y: Math.max(B.front.y, B.top.y) },
    layer: 'construction',
  });

  // True-length rotation construction: rotate the TV onto a horizontal through a'
  // so the resulting hypotenuse has the true length L.
  const fvLen = Math.hypot(B.front.x - A.front.x, B.front.y - A.front.y);
  const tvLen = Math.hypot(B.top.x - A.top.x, B.top.y - A.top.y);
  const tlEnd: Pt = { x: A.front.x + tvLen, y: A.front.y };
  builder.line({
    tool: '2H Pencil',
    instruction: 'Construction: rotate top-view length onto horizontal through a′',
    from: A.front,
    to: tlEnd,
    layer: 'construction',
  });
  builder.line({
    tool: '2H Pencil',
    instruction: 'Construction: vertical (height difference) at end of rotated length',
    from: tlEnd,
    to: { x: tlEnd.x, y: B.front.y },
    layer: 'construction',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'TRUE LENGTH (hypotenuse of the rotation triangle)',
    from: A.front,
    to: { x: tlEnd.x, y: B.front.y },
    layer: 'final',
  });

  const summary = [
    `Line ${spec.name} has true length ${fmt(L)}mm, inclined ${
      spec.hpAngleDeg ?? 0
    }° to HP and ${spec.vpAngleDeg ?? 0}° to VP, with end A ${fmt(aHp)}mm above HP and ${fmt(
      aVp
    )}mm in front of VP.`,
    `Its 3-D direction vector is L·(${fmt(dx / L, 3)}, ${fmt(dy / L, 3)}, ${fmt(
      dz / L,
      3
    )}). Front view a′b′ length = ${fmt(fvLen)}mm; top view ab length = ${fmt(
      tvLen
    )}mm — neither shows the true length when both inclinations are non-zero.`,
    `The trapezoidal/rotation construction recovers the true length: rotate the TV horizontally and drop the FV height-difference at the end. The hypotenuse is the true length.`,
  ].join(' ');

  return { strokes: builder.build(), paper, summary };
}

function drawEndpoint(builder: StrokeBuilder, at: Pt, label: string, side: 'left' | 'right'): void {
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Endpoint ${label}`,
    center: at,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: `Label ${label}`,
    at: { x: at.x + (side === 'left' ? -4 : 4), y: at.y },
    text: label,
    align: side === 'left' ? 'end' : 'start',
    baseline: 'middle',
    fontSize: 4.5,
  });
}
