import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, drawTitle, xyLineY, pageCenterX } from './layout';
import { fmt } from './geometry';

/* ============================================================ *
 *  Hyperbola — rectangular hyperbola xy = c² method
 * ============================================================ */

export interface HyperbolaSpec {
  /** Half horizontal extent in mm (the figure spans 2·widthMm horizontally). */
  widthMm: number;
  /** Half vertical extent in mm. */
  heightMm: number;
  /** Distance from origin to the asymptote-corner used as a reference point. */
  ordinateMm: number;
  /** Abscissa of the same reference point. */
  abscissaMm: number;
}

/**
 * Draw a rectangular hyperbola x·y = c² passing through a known point (a, b).
 * Method: for several horizontal x-values, compute y = (a·b)/x and join smoothly.
 */
export function buildHyperbola(spec: HyperbolaSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(
    builder,
    `Rectangular Hyperbola through (${fmt(spec.abscissaMm)}, ${fmt(spec.ordinateMm)})mm — xy=c² method`
  );

  const cx = pageCenterX();
  const cy = xyLineY() + 30;
  const c2 = spec.abscissaMm * spec.ordinateMm;

  // Asymptotes
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the horizontal asymptote (x-axis)',
    from: { x: 60, y: cy },
    to: { x: PAGE.widthMm - 60, y: cy },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Draw the vertical asymptote (y-axis)',
    from: { x: cx, y: cy - spec.heightMm - 20 },
    to: { x: cx, y: cy + 20 },
    layer: 'final',
  });

  // Sample several x positions in the first quadrant and mirror to others.
  const N = 12;
  const xMin = c2 / spec.heightMm; // y at this x is heightMm
  const xMax = spec.widthMm;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = xMin * Math.pow(xMax / xMin, t); // log spacing — denser near the asymptote
    const y = c2 / x;
    pts.push({ x: cx + x, y: cy - y });
    // Construction: vertical at x and horizontal at y
    builder.line({
      tool: '2H Pencil',
      instruction: `Construction: vertical at x = ${fmt(x)}mm`,
      from: { x: cx + x, y: cy },
      to: { x: cx + x, y: cy - y },
      layer: 'construction',
    });
    builder.line({
      tool: '2H Pencil',
      instruction: `Construction: horizontal at y = ${fmt(y)}mm`,
      from: { x: cx, y: cy - y },
      to: { x: cx + x, y: cy - y },
      layer: 'construction',
    });
  }

  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Smooth hyperbola through the constructed points',
    points: pts,
    layer: 'final',
  });

  // Highlight the reference point P
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Reference point P at (${fmt(spec.abscissaMm)}, ${fmt(spec.ordinateMm)})mm`,
    center: { x: cx + spec.abscissaMm, y: cy - spec.ordinateMm },
    radius: 1,
    layer: 'final',
  });
  builder.text({
    instruction: 'Label reference point P',
    at: { x: cx + spec.abscissaMm + 4, y: cy - spec.ordinateMm - 2 },
    text: 'P',
    fontSize: 4.5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `A rectangular hyperbola has equation x·y = c² where c² = ab for any given point (a, b). Here a = ${fmt(
      spec.abscissaMm
    )}mm and b = ${fmt(spec.ordinateMm)}mm, so c² = ${fmt(
      c2
    )}mm². The asymptotes are the x and y axes themselves. For each chosen x, the corresponding y is c²/x; joining ${
      N + 1
    } such points smoothly gives the branch of the hyperbola.`,
  };
}

/* ============================================================ *
 *  Archimedean spiral
 * ============================================================ */

export interface SpiralSpec {
  /** Starting radius in mm (typically 0 for an Archimedean spiral, but allow >0). */
  startRadius?: number;
  /** Final outer radius in mm. */
  endRadius: number;
  /** Number of convolutions (turns). */
  turns: number;
  /** Sampling density (points per turn). */
  pointsPerTurn?: number;
}

export function buildArchimedeanSpiral(spec: SpiralSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const r0 = spec.startRadius ?? 0;
  const r1 = spec.endRadius;
  const turns = spec.turns;
  drawTitle(builder, `Archimedean Spiral — ${turns} turns, R₀=${fmt(r0)}mm, R₁=${fmt(r1)}mm`);

  const c: Pt = { x: pageCenterX(), y: xyLineY() + 10 };

  // Reference circle of final radius (construction)
  builder.circle({
    tool: 'Compass',
    instruction: `Draw the bounding circle of radius ${fmt(r1)}mm`,
    center: c,
    radius: r1,
    layer: 'construction',
  });

  // Radial divisions (12 per turn) and circular divisions (split radius into 12)
  const radials = 12;
  for (let i = 0; i < radials; i++) {
    const a = (i * 2 * Math.PI) / radials;
    builder.line({
      tool: '2H Pencil',
      instruction: `Radial division at ${(i * 360) / radials}°`,
      from: c,
      to: { x: c.x + r1 * Math.cos(a), y: c.y + r1 * Math.sin(a) },
      layer: 'construction',
    });
  }
  for (let i = 1; i <= radials; i++) {
    const r = (r1 * i) / radials;
    builder.circle({
      tool: '2H Pencil',
      instruction: `Reference circle of radius ${fmt(r)}mm`,
      center: c,
      radius: r,
      layer: 'construction',
    });
  }

  // Spiral points: r = r0 + (r1 - r0) × (θ / (2π·turns))
  const ppt = spec.pointsPerTurn ?? 24;
  const N = ppt * turns;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i * 2 * Math.PI) / ppt;
    const r = r0 + ((r1 - r0) * theta) / (2 * Math.PI * turns);
    pts.push({ x: c.x + r * Math.cos(theta), y: c.y + r * Math.sin(theta) });
  }

  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Smooth Archimedean spiral through the constructed points',
    points: pts,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `An Archimedean spiral has the polar equation r = a + b·θ with constant linear growth per turn. Here a = ${fmt(
      r0
    )}mm and the pitch is (R₁ − R₀)/${turns} = ${fmt(
      (r1 - r0) / turns
    )}mm per turn. The construction divides the bounding circle into 12 equal sectors, draws ${radials} concentric reference circles, and marks the spiral's position at each ${
      360 / radials
    }° rotation using a radius that grows linearly with the angle.`,
  };
}

/* ============================================================ *
 *  Epi- and hypo-cycloid
 * ============================================================ */

export interface EpiHypoSpec {
  /** Diameter of the rolling (small) circle in mm. */
  rollDiameterMm: number;
  /** Diameter of the directing (large) circle in mm. */
  baseDiameterMm: number;
  /** 'epi' = rolls on outside, 'hypo' = rolls on inside. */
  kind: 'epi' | 'hypo';
}

export function buildEpiOrHypoCycloid(spec: EpiHypoSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const r = spec.rollDiameterMm / 2;
  const R = spec.baseDiameterMm / 2;
  const sign = spec.kind === 'epi' ? 1 : -1;

  drawTitle(
    builder,
    `${spec.kind === 'epi' ? 'Epi' : 'Hypo'}cycloid — rolling Ø${fmt(spec.rollDiameterMm)} on ${
      spec.kind === 'epi' ? 'outside' : 'inside'
    } of Ø${fmt(spec.baseDiameterMm)}`
  );

  const c: Pt = { x: pageCenterX(), y: xyLineY() + 30 };

  // Directing circle
  builder.circle({
    tool: 'Compass',
    instruction: `Draw the directing circle of radius ${fmt(R)}mm`,
    center: c,
    radius: R,
    layer: 'final',
  });

  // Sweep angle to complete one revolution of the rolling circle in contact terms
  // θ_max on the directing circle = 2π · r / R (so the rolled distance = 2πr)
  const thetaMax = (2 * Math.PI * r) / R;

  const N = 36;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (thetaMax * i) / N;
    // Centre of the rolling circle at angle θ on the base
    const cxRoll = c.x + (R + sign * r) * Math.cos(theta);
    const cyRoll = c.y + (R + sign * r) * Math.sin(theta);
    // The generating point P, initially at the contact (angle 0 on base).
    // After rolling, P is at angle φ around the rolling-circle centre, where
    //   for epicycloid:  φ = -((R + r)/r) · θ
    //   for hypocycloid: φ =  ((R - r)/r) · θ
    const phi = sign === 1
      ? -(R + r) / r * theta
      : (R - r) / r * theta;
    // Initial offset of P relative to rolling-circle centre: from the contact point
    // toward the origin (i.e. opposite radial). Magnitude = r.
    const baseAngle = theta; // direction of the radius from origin to contact
    const offset = sign === 1 ? -1 : 1; // epi: P starts radially outward (no — start at contact, between centres)
    void offset;
    // Easiest: derive from the standard parametric forms.
    let px: number, py: number;
    if (spec.kind === 'epi') {
      px = c.x + (R + r) * Math.cos(theta) - r * Math.cos(((R + r) / r) * theta);
      py = c.y + (R + r) * Math.sin(theta) - r * Math.sin(((R + r) / r) * theta);
    } else {
      px = c.x + (R - r) * Math.cos(theta) + r * Math.cos(((R - r) / r) * theta);
      py = c.y + (R - r) * Math.sin(theta) - r * Math.sin(((R - r) / r) * theta);
    }
    pts.push({ x: px, y: py });

    if (i > 0 && i < N && i % 3 === 0) {
      builder.circle({
        tool: '2H Pencil',
        instruction: `Construction circle: rolling circle at θ = ${fmt((theta * 180) / Math.PI)}°`,
        center: { x: cxRoll, y: cyRoll },
        radius: r,
        layer: 'construction',
      });
    }
    // unused variables; baseAngle, phi only needed for some pedagogical annotations.
    void baseAngle;
    void phi;
  }

  builder.curve({
    tool: 'HB Pencil',
    instruction: `Smooth ${spec.kind}cycloid through the constructed points`,
    points: pts,
    layer: 'final',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `A${spec.kind === 'epi' ? 'n epicycloid' : ' hypocycloid'} is traced by a point on a circle of radius r = ${fmt(
      r
    )}mm as it rolls without slipping on the ${
      spec.kind === 'epi' ? 'outside' : 'inside'
    } of a fixed circle of radius R = ${fmt(R)}mm. The parametric equations are:\n  ${
      spec.kind === 'epi'
        ? 'x(θ) = (R+r)cos θ − r·cos((R+r)/r · θ),  y(θ) = (R+r)sin θ − r·sin((R+r)/r · θ)'
        : 'x(θ) = (R−r)cos θ + r·cos((R−r)/r · θ),  y(θ) = (R−r)sin θ − r·sin((R−r)/r · θ)'
    }\nOne full revolution of the rolling circle corresponds to θ_max = 2π·r/R = ${fmt(
      (thetaMax * 180) / Math.PI
    )}° on the base circle. The curve closes after r/R reductions when r/R is rational.`,
  };
}

/* ============================================================ *
 *  Helix (on cylinder)
 * ============================================================ */

export interface HelixSpec {
  diameterMm: number;
  /** Pitch in mm — axial distance per revolution. */
  pitchMm: number;
  /** Number of turns. */
  turns: number;
}

export function buildHelix(spec: HelixSpec): {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
} {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const R = spec.diameterMm / 2;
  const totalH = spec.pitchMm * spec.turns;
  drawTitle(builder, `Cylindrical Helix — Ø${fmt(spec.diameterMm)}mm, pitch ${fmt(spec.pitchMm)}mm, ${spec.turns} turns`);

  // FRONT VIEW: rectangle of width = diameter, height = totalH
  const fvCx = pageCenterX() - 100;
  const baseY = xyLineY() + totalH / 2 + 30;
  const topY = baseY - totalH;

  builder.line({
    tool: 'T-Square',
    instruction: 'Base of cylinder front view',
    from: { x: fvCx - R, y: baseY },
    to: { x: fvCx + R, y: baseY },
    layer: 'final',
  });
  builder.line({
    tool: 'T-Square',
    instruction: 'Top of cylinder front view',
    from: { x: fvCx - R, y: topY },
    to: { x: fvCx + R, y: topY },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Left generator of cylinder',
    from: { x: fvCx - R, y: baseY },
    to: { x: fvCx - R, y: topY },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right generator of cylinder',
    from: { x: fvCx + R, y: baseY },
    to: { x: fvCx + R, y: topY },
    layer: 'final',
  });

  // TOP VIEW: circle of radius R, divided into 12 sectors
  const tvCx = pageCenterX() + 100;
  const tvCy = baseY + 60;
  builder.circle({
    tool: 'Compass',
    instruction: 'Draw the top view (circular section) of the cylinder',
    center: { x: tvCx, y: tvCy },
    radius: R,
    layer: 'final',
  });
  for (let i = 0; i < 12; i++) {
    const a = (i * 2 * Math.PI) / 12;
    builder.line({
      tool: '2H Pencil',
      instruction: `Radial division ${i + 1} at ${i * 30}°`,
      from: { x: tvCx, y: tvCy },
      to: { x: tvCx + R * Math.cos(a), y: tvCy + R * Math.sin(a) },
      layer: 'construction',
    });
  }

  // Helix curve in FV: x = sin(2π·t·turns)·R (sinusoidal silhouette), y = baseY - t·totalH
  const M = 12 * spec.turns;
  const fvPts: Pt[] = [];
  const tvPts: Pt[] = [];
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    const theta = 2 * Math.PI * spec.turns * t;
    fvPts.push({ x: fvCx + R * Math.cos(theta), y: baseY - t * totalH });
    tvPts.push({ x: tvCx + R * Math.cos(theta), y: tvCy + R * Math.sin(theta) });
  }

  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Front view of helix — sinusoidal projection of a helix onto a plane containing the axis',
    points: fvPts,
    layer: 'final',
  });
  builder.curve({
    tool: 'HB Pencil',
    instruction: 'Top view of helix — circle (the generator traces the base circle once per turn)',
    points: tvPts,
    layer: 'construction',
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `A right-handed cylindrical helix of diameter ${fmt(
      spec.diameterMm
    )}mm and pitch ${fmt(spec.pitchMm)}mm rises ${fmt(
      spec.pitchMm
    )}mm along the axis per full revolution. The top view is the base circle (the helix projects onto a circle when viewed along the axis); the front view is a sinusoid because x(θ) = R·cos θ varies sinusoidally with the angle, while y(θ) = pitch·(θ/2π) is linear in θ.`,
  };
}
