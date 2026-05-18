import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, pageCenterX, xyLineY } from './layout';

export interface CycloidSpec {
  /** Diameter of the rolling circle (mm) */
  diameterMm: number;
  /** Number of construction divisions; default 12 */
  divisions?: number;
}

/**
 * Cycloid: trace of a point on a circle as it rolls along a horizontal line.
 * Parametric: x(θ) = R(θ − sin θ),  y(θ) = R(1 − cos θ)
 */
export function buildCycloid(spec: CycloidSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const R = spec.diameterMm / 2;
  const N = spec.divisions ?? 12;
  const baseY = xyLineY() + 50; // directrix
  const startX = pageCenterX() - Math.PI * R; // so the curve is centered

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Cycloid — rolling circle diameter ${spec.diameterMm}mm`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Directrix (the line the circle rolls on)
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the directrix (line on which the circle rolls)',
    from: { x: startX - 20, y: baseY },
    to: { x: startX + 2 * Math.PI * R + 20, y: baseY },
    layer: 'final',
  });

  // The center moves along a horizontal line at height R above the directrix
  const centerY = baseY - R;

  // Initial circle (at start position)
  builder.circle({
    tool: 'Compass',
    instruction: `Draw the rolling circle at start position (radius ${R.toFixed(1)}mm)`,
    center: { x: startX, y: centerY },
    radius: R,
    layer: 'final',
  });

  // Mark the tracing point P at the bottom of the start circle (on the directrix)
  builder.text({
    instruction: 'Mark generating point P at bottom of the rolling circle',
    at: { x: startX - 4, y: baseY - 1 },
    text: 'P',
    align: 'end',
    baseline: 'auto',
    fontSize: 4.5,
  });

  // Divide the circumference into N equal parts.
  // For each division i, after the circle has rolled by angle θ = i*(2π/N):
  // - center is at (startX + R*θ, centerY)
  // - the original point P is now at: center + R*(-sin θ, -cos θ)  [θ measured CW from bottom]
  // (We use −cos because y-axis grows downward.)
  const points: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i * 2 * Math.PI) / N;
    const cxRolled = startX + R * theta;
    const px = cxRolled - R * Math.sin(theta);
    const py = centerY + R * Math.cos(theta);
    points.push({ x: px, y: py });

    // Construction: each rolled position of the circle
    if (i > 0 && i < N) {
      builder.circle({
        tool: '2H Pencil',
        instruction: `Construction circle at division ${i}`,
        center: { x: cxRolled, y: centerY },
        radius: R,
        layer: 'construction',
      });
    }
  }

  // Centers' path
  builder.line({
    tool: '2H Pencil',
    instruction: 'Draw the path of the rolling-circle center (parallel to directrix at height R)',
    from: { x: startX, y: centerY },
    to: { x: startX + 2 * Math.PI * R, y: centerY },
    layer: 'construction',
  });

  // Cycloid curve
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Sketch a smooth cycloid through the constructed points',
    points,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `As a circle of radius ${R.toFixed(
      1
    )}mm rolls along a straight directrix without slipping, the generating point P (initially at the contact point) traces a cycloid given by x(θ) = R(θ − sin θ), y(θ) = R(1 − cos θ). The curve repeats every 2πR ≈ ${(
      2 * Math.PI * R
    ).toFixed(1)}mm and reaches a maximum height of 2R = ${(2 * R).toFixed(
      1
    )}mm. The construction divides the circumference into ${N} equal parts; for each, the circle is redrawn at its new center and the corresponding position of P is marked. Joining all positions smoothly gives the cycloid.`,
  };
}

export interface InvoluteSpec {
  /** Circle (or polygon) diameter in mm */
  diameterMm: number;
  /** Optional polygon-side approximation count (default = circle, smooth) */
  divisions?: number;
}

/**
 * Involute of a circle: trace of a point on a string unwound from the circle.
 * One full involute corresponds to unwinding a length equal to the circumference.
 */
export function buildInvoluteOfCircle(spec: InvoluteSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const R = spec.diameterMm / 2;
  const N = spec.divisions ?? 12;
  const cx = pageCenterX();
  const cy = xyLineY() + 20;

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Involute of a Circle — diameter ${spec.diameterMm}mm`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Base circle
  builder.circle({
    tool: 'Compass',
    instruction: `Draw the base circle (radius ${R.toFixed(1)}mm)`,
    center: { x: cx, y: cy },
    radius: R,
    layer: 'final',
  });

  // Mark starting point P at angle 0 (rightmost point)
  const P0: Pt = { x: cx + R, y: cy };
  builder.text({
    instruction: 'Mark starting point P on the base circle',
    at: { x: P0.x + 3, y: P0.y },
    text: 'P',
    align: 'start',
    baseline: 'middle',
    fontSize: 4.5,
  });

  // Divide circle into N equal parts. At division i (angle θ = i·2π/N from start):
  //   tangent at division point has length = arc length unwound = R·θ
  //   tangent direction is perpendicular to radius
  //   end of unwound string = division point + tangent_dir · (R·θ)
  const points: Pt[] = [P0];
  for (let i = 1; i <= N; i++) {
    const theta = (i * 2 * Math.PI) / N;
    const dx = cx + R * Math.cos(theta);
    const dy = cy - R * Math.sin(theta);
    // Tangent perpendicular to radius (rotate radius by -90° for the unwinding direction)
    const tx = Math.sin(theta);
    const ty = Math.cos(theta);
    const arcLen = R * theta;
    const ex = dx + tx * arcLen;
    const ey = dy + ty * arcLen;
    points.push({ x: ex, y: ey });

    // Tangent construction line
    builder.line({
      tool: '2H Pencil',
      instruction: `Tangent at division ${i}, length ${arcLen.toFixed(1)}mm (arc unwound)`,
      from: { x: dx, y: dy },
      to: { x: ex, y: ey },
      layer: 'construction',
    });
  }

  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Smooth involute through the constructed points',
    points,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `The involute of a circle is the path traced by the end of a taut string as it is unwound from the circle. Divide the circumference into ${N} equal parts; for each division point, draw the tangent perpendicular to the radius. The length of this tangent equals the arc length unwound from the start (R·θ for division at angle θ). Marking each tangent endpoint and joining them smoothly gives the involute. After one full unwind (θ = 2π), the tangent length equals the circumference 2πR ≈ ${(
      2 *
      Math.PI *
      R
    ).toFixed(1)}mm.`,
  };
}
