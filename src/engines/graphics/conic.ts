import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, pageCenterX, xyLineY } from './layout';

export interface EllipseSpec {
  majorMm: number;
  minorMm: number;
  /** 'concentric' = concentric circles method; default */
  method?: 'concentric';
}

export function buildEllipseConcentric(spec: EllipseSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const cx = pageCenterX();
  const cy = xyLineY();
  const majorR = spec.majorMm / 2;
  const minorR = spec.minorMm / 2;

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 28 },
    text: `Ellipse — Major axis ${spec.majorMm}mm, Minor axis ${spec.minorMm}mm (concentric circles method)`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Major axis line
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the major axis (horizontal)',
    from: { x: cx - majorR - 10, y: cy },
    to: { x: cx + majorR + 10, y: cy },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Draw the minor axis (vertical)',
    from: { x: cx, y: cy - minorR - 10 },
    to: { x: cx, y: cy + minorR + 10 },
    layer: 'final',
  });

  // Major (outer) circle
  builder.circle({
    tool: 'Compass',
    instruction: `Draw major circle of radius ${majorR.toFixed(1)}mm centered on origin`,
    center: { x: cx, y: cy },
    radius: majorR,
    layer: 'construction',
  });

  // Minor (inner) circle
  builder.circle({
    tool: 'Compass',
    instruction: `Draw minor circle of radius ${minorR.toFixed(1)}mm`,
    center: { x: cx, y: cy },
    radius: minorR,
    layer: 'construction',
  });

  // Divide the major circle into 12 equal parts. From each division point on the
  // major circle, draw a vertical line; from the corresponding minor circle point,
  // a horizontal line. Their intersection is a point on the ellipse.
  const N = 12;
  const ellipsePoints: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const theta = (2 * Math.PI * i) / N;
    const xMaj = cx + majorR * Math.cos(theta);
    const yMaj = cy - majorR * Math.sin(theta);
    const xMin = cx + minorR * Math.cos(theta);
    const yMin = cy - minorR * Math.sin(theta);
    // Construction line from major-circle point straight down/up
    builder.line({
      tool: '2H Pencil',
      instruction: `Construction: vertical from major-circle div ${i + 1}`,
      from: { x: xMaj, y: yMaj },
      to: { x: xMaj, y: yMin },
      layer: 'construction',
    });
    // Construction line from minor-circle point straight left/right
    builder.line({
      tool: '2H Pencil',
      instruction: `Construction: horizontal from minor-circle div ${i + 1}`,
      from: { x: xMin, y: yMin },
      to: { x: xMaj, y: yMin },
      layer: 'construction',
    });
    ellipsePoints.push({ x: xMaj, y: yMin });
  }
  ellipsePoints.push(ellipsePoints[0]); // close

  // Final ellipse curve through points
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Sketch the smooth ellipse through the constructed points',
    points: ellipsePoints,
    closed: true,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `The concentric-circles method draws two circles centered at the same origin: the major (radius = ${majorR.toFixed(
      1
    )}mm) and the minor (radius = ${minorR.toFixed(
      1
    )}mm). Both circles are divided into the same number of equal angular parts (${N} here). For each division, a vertical line through the major-circle point meets a horizontal line through the minor-circle point at exactly one point on the ellipse. Joining these 12 points smoothly gives the ellipse.`,
  };
}

export interface ParabolaSpec {
  /** Width along base (abscissa), mm */
  abscissaMm: number;
  /** Height (ordinate), mm */
  ordinateMm: number;
}

export function buildParabolaRectangle(spec: ParabolaSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const cx = pageCenterX();
  const baseY = xyLineY() + spec.ordinateMm / 2;
  const apexY = xyLineY() - spec.ordinateMm / 2;
  const left = cx - spec.abscissaMm / 2;
  const right = cx + spec.abscissaMm / 2;

  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Parabola — abscissa ${spec.abscissaMm}mm, ordinate ${spec.ordinateMm}mm (rectangle method)`,
    align: 'middle',
    fontSize: 6.5,
  });

  // Rectangle: base, top, two sides
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw base of rectangle',
    from: { x: left, y: baseY },
    to: { x: right, y: baseY },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Left side of rectangle',
    from: { x: left, y: baseY },
    to: { x: left, y: apexY },
    layer: 'construction',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right side of rectangle',
    from: { x: right, y: baseY },
    to: { x: right, y: apexY },
    layer: 'construction',
  });
  builder.line({
    tool: 'T-Square',
    instruction: 'Top side of rectangle',
    from: { x: left, y: apexY },
    to: { x: right, y: apexY },
    layer: 'construction',
  });

  // Axis of parabola (vertical through apex)
  builder.line({
    tool: 'Set Square',
    instruction: 'Draw axis of parabola through apex',
    from: { x: cx, y: apexY - 10 },
    to: { x: cx, y: baseY + 10 },
    layer: 'construction',
  });

  // Divide right half-base and right side into N equal parts; connect to apex.
  const N = 6;
  // Half base: from cx (apex projection on base) to right edge
  const dxBase = (right - cx) / N;
  const dyHeight = (baseY - apexY) / N;

  // For each i from 1..N-1:
  //   Point on side: (right, baseY - i*dyHeight)
  //   Point on base: (cx + i*dxBase, baseY)
  //   Connect side-point to apex (cx, apexY)
  //   Vertical from base-point upward
  //   Their intersection lies on the parabola
  const points: Pt[] = [{ x: cx, y: apexY }];
  for (let i = 1; i <= N; i++) {
    const sidePt = { x: right, y: baseY - i * dyHeight };
    const basePt = { x: cx + i * dxBase, y: baseY };
    // Right side division
    builder.line({
      tool: '2H Pencil',
      instruction: `Connect right-side division ${i} to apex`,
      from: sidePt,
      to: { x: cx, y: apexY },
      layer: 'construction',
    });
    // Vertical from base-point
    builder.line({
      tool: '2H Pencil',
      instruction: `Vertical from base division ${i}`,
      from: basePt,
      to: { x: basePt.x, y: apexY },
      layer: 'construction',
    });
    // Compute intersection
    // Line from sidePt to apex: parameterize by t in [0,1]; at t, x = right + t*(cx-right) = right - t*(right-cx)
    // We want x = basePt.x, i.e. right - t*(right-cx) = cx + i*dxBase = right - (N-i)*dxBase  → t*(right-cx) = (N-i)*dxBase
    // t = (N-i)/N  (assuming dxBase = (right-cx)/N)
    const t = (N - i) / N;
    const yIntersect = sidePt.y + t * (apexY - sidePt.y);
    points.push({ x: basePt.x, y: yIntersect });
  }

  // Mirror to left half
  const leftPoints: Pt[] = [];
  for (let i = points.length - 1; i >= 1; i--) {
    leftPoints.push({ x: 2 * cx - points[i].x, y: points[i].y });
  }
  const all = [...leftPoints, ...points];

  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Sketch the parabola through the constructed points',
    points: all,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `The rectangle method encloses the parabola in a rectangle of width ${
      spec.abscissaMm
    }mm and height ${
      spec.ordinateMm
    }mm. The half-base and one vertical side are each divided into the same number of equal parts (${N} here). For each division, a line from the side division to the apex meets a vertical line from the base division at one point on the parabola. Mirroring across the axis completes the curve.`,
  };
}
