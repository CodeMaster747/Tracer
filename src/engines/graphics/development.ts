import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { drawTitle, xyLineY, pageCenterX, PAGE } from './layout';
import { deg2rad, fmt, regularPolygon } from './geometry';

export type DevelopmentSolidShape = 'prism' | 'pyramid' | 'cylinder' | 'cone';

export interface DevelopmentSpec {
  shape: DevelopmentSolidShape;
  sizeMm: number;
  axisMm?: number;
  sides?: number;
}

interface DevelopmentResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

/**
 * Build the development of the lateral surface (no top/bottom faces) of the given solid.
 * Strategy: unwrap each lateral face into the page plane and lay them side by side.
 */
export function buildDevelopment(spec: DevelopmentSpec): DevelopmentResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(builder, `Development of ${label(spec)}`);

  switch (spec.shape) {
    case 'prism':
      return prismDevelopment(spec, builder, paper);
    case 'pyramid':
      return pyramidDevelopment(spec, builder, paper);
    case 'cylinder':
      return cylinderDevelopment(spec, builder, paper);
    case 'cone':
      return coneDevelopment(spec, builder, paper);
  }
}

/* ----- Prism ----- */

function prismDevelopment(
  spec: DevelopmentSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): DevelopmentResult {
  const n = spec.sides ?? 6;
  const side = spec.sizeMm;
  const h = spec.axisMm ?? side * 1.5;
  const totalW = n * side;
  const baseY = xyLineY() + 60;
  const startX = pageCenterX() - totalW / 2;

  // Bottom edge of development
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the base reference line for the development',
    from: { x: startX, y: baseY },
    to: { x: startX + totalW, y: baseY },
    layer: 'final',
  });
  // Top edge
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the top reference line for the development',
    from: { x: startX, y: baseY - h },
    to: { x: startX + totalW, y: baseY - h },
    layer: 'final',
  });
  // Vertical edges between faces
  for (let i = 0; i <= n; i++) {
    builder.line({
      tool: 'Set Square',
      instruction: i === 0 || i === n ? 'Outer edge of development' : `Edge between face ${i} and ${i + 1}`,
      from: { x: startX + i * side, y: baseY },
      to: { x: startX + i * side, y: baseY - h },
      layer: 'final',
    });
    // Label
    if (i < n) {
      builder.text({
        instruction: `Face label ${i + 1}`,
        at: { x: startX + (i + 0.5) * side, y: baseY + 6 },
        text: `Face ${i + 1}`,
        align: 'middle',
        fontSize: 4,
      });
    }
  }

  // Dimension annotations
  dimension(builder, {
    from: { x: startX, y: baseY + 14 },
    to: { x: startX + side, y: baseY + 14 },
    text: `${fmt(side)}mm`,
  });
  dimension(builder, {
    from: { x: startX - 14, y: baseY },
    to: { x: startX - 14, y: baseY - h },
    text: `${fmt(h)}mm`,
    vertical: true,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `The lateral surface of a ${prismName(n)} prism unrolls into ${n} identical rectangles laid side-by-side, each ${fmt(
      side
    )}mm wide and ${fmt(h)}mm tall. The total length is ${fmt(n * side)}mm (the perimeter of the base).`,
  };
}

/* ----- Pyramid ----- */

function pyramidDevelopment(
  spec: DevelopmentSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): DevelopmentResult {
  const n = spec.sides ?? 6;
  const side = spec.sizeMm;
  const h = spec.axisMm ?? side * 1.5;
  const r = side / (2 * Math.sin(Math.PI / n)); // base circum-radius
  const slant = Math.sqrt(h * h + r * r); // axial slant edge length

  const apex: Pt = { x: pageCenterX(), y: 110 };

  // Each lateral face is an isoceles triangle with two sides = slant and base = side.
  // Half-angle at apex for each triangle is α where sin α = (side/2)/slant
  const alpha = Math.asin(side / 2 / slant);

  // Total wedge angle subtended at the apex
  const total = 2 * alpha * n;

  // Lay it out symmetric around the downward direction.
  const startAngle = Math.PI / 2 - total / 2;

  // Draw the arc-like boundary by drawing each face edge from the apex.
  const edgePts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = startAngle + 2 * alpha * i;
    edgePts.push({
      x: apex.x + slant * Math.cos(a),
      y: apex.y + slant * Math.sin(a),
    });
  }

  for (let i = 0; i < edgePts.length; i++) {
    builder.line({
      tool: 'HB Pencil',
      instruction: i === 0 || i === n
        ? 'Outer slant edge of development'
        : `Edge between face ${i} and ${i + 1}`,
      from: apex,
      to: edgePts[i],
      layer: 'final',
    });
  }
  for (let i = 0; i < n; i++) {
    builder.line({
      tool: 'HB Pencil',
      instruction: `Base edge of face ${i + 1}`,
      from: edgePts[i],
      to: edgePts[i + 1],
      layer: 'final',
    });
  }

  // Dimensions
  builder.text({
    instruction: 'Slant length annotation',
    at: { x: apex.x + 8, y: apex.y + slant / 2 },
    text: `slant = ${fmt(slant)}mm`,
    fontSize: 4,
  });
  builder.text({
    instruction: 'Base edge annotation',
    at: { x: (edgePts[0].x + edgePts[1].x) / 2, y: (edgePts[0].y + edgePts[1].y) / 2 + 6 },
    text: `${fmt(side)}mm`,
    align: 'middle',
    fontSize: 4,
  });
  builder.text({
    instruction: 'Apex marker',
    at: { x: apex.x, y: apex.y - 4 },
    text: 'O',
    align: 'middle',
    fontSize: 5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Development of a ${prismName(
      n
    )} pyramid. The slant edge length is √(h² + r²) = √(${fmt(h)}² + ${fmt(r)}²) = ${fmt(
      slant
    )}mm where r is the circum-radius of the base. Each lateral face is an isosceles triangle with the slant as the two equal sides and the base side (${fmt(
      side
    )}mm) as the base. All ${n} triangles share a common apex; the wedge angle each subtends at the apex is 2·sin⁻¹(side/(2·slant)) = ${fmt(
      (2 * alpha * 180) / Math.PI,
      2
    )}°.`,
  };
}

/* ----- Cylinder ----- */

function cylinderDevelopment(
  spec: DevelopmentSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): DevelopmentResult {
  const R = spec.sizeMm / 2;
  const h = spec.axisMm ?? spec.sizeMm * 1.5;
  const circumference = 2 * Math.PI * R;
  const startX = pageCenterX() - circumference / 2;
  const baseY = xyLineY() + 60;

  // Rectangle: width = circumference, height = h
  builder.line({
    tool: 'T-Square',
    instruction: 'Bottom of development rectangle (base circumference unrolled)',
    from: { x: startX, y: baseY },
    to: { x: startX + circumference, y: baseY },
    layer: 'final',
  });
  builder.line({
    tool: 'T-Square',
    instruction: 'Top of development rectangle',
    from: { x: startX, y: baseY - h },
    to: { x: startX + circumference, y: baseY - h },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Left edge of development',
    from: { x: startX, y: baseY },
    to: { x: startX, y: baseY - h },
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right edge of development',
    from: { x: startX + circumference, y: baseY },
    to: { x: startX + circumference, y: baseY - h },
    layer: 'final',
  });

  // Subdivision lines every 30° (12 divisions of circumference)
  for (let i = 1; i < 12; i++) {
    const x = startX + (circumference * i) / 12;
    builder.line({
      tool: '2H Pencil',
      instruction: `Subdivision ${i}/12 (corresponds to ${i * 30}° around the base)`,
      from: { x, y: baseY },
      to: { x, y: baseY - h },
      layer: 'construction',
    });
  }

  dimension(builder, {
    from: { x: startX, y: baseY + 14 },
    to: { x: startX + circumference, y: baseY + 14 },
    text: `π·D = ${fmt(circumference)}mm`,
  });
  dimension(builder, {
    from: { x: startX - 14, y: baseY },
    to: { x: startX - 14, y: baseY - h },
    text: `${fmt(h)}mm`,
    vertical: true,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `The lateral surface of a cylinder of diameter ${fmt(
      spec.sizeMm
    )}mm and height ${fmt(h)}mm unrolls into a rectangle of width π·D = ${fmt(
      circumference
    )}mm and height ${fmt(h)}mm. We subdivide it into 12 equal strips to show how each 30° arc of the base maps to one strip.`,
  };
}

/* ----- Cone ----- */

function coneDevelopment(
  spec: DevelopmentSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): DevelopmentResult {
  const R = spec.sizeMm / 2;
  const h = spec.axisMm ?? spec.sizeMm * 1.5;
  const slant = Math.sqrt(h * h + R * R);
  const wedgeAngle = (2 * Math.PI * R) / slant; // radians: arc length / radius

  const apex: Pt = { x: pageCenterX(), y: 100 };

  // Sector boundary arc — sweep across the wedge
  const startA = Math.PI / 2 - wedgeAngle / 2;
  const N = 48;
  const arc: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const a = startA + (wedgeAngle * i) / N;
    arc.push({
      x: apex.x + slant * Math.cos(a),
      y: apex.y + slant * Math.sin(a),
    });
  }
  // Two radial edges
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Left radial edge of cone development (length = slant)',
    from: apex,
    to: arc[0],
    layer: 'final',
  });
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Right radial edge of cone development (length = slant)',
    from: apex,
    to: arc[arc.length - 1],
    layer: 'final',
  });
  // Outer arc as a curve
  builder.curve({
    tool: 'Compass',
    instruction: `Outer arc of the development (radius = slant length ${fmt(slant)}mm, sweep ${fmt(
      (wedgeAngle * 180) / Math.PI,
      1
    )}°)`,
    points: arc,
    layer: 'final',
  });
  // 12 generator lines
  for (let i = 1; i < 12; i++) {
    const a = startA + (wedgeAngle * i) / 12;
    builder.line({
      tool: '2H Pencil',
      instruction: `Generator ${i} (corresponds to ${i * 30}° around the base)`,
      from: apex,
      to: { x: apex.x + slant * Math.cos(a), y: apex.y + slant * Math.sin(a) },
      layer: 'construction',
    });
  }

  // Annotations
  builder.text({
    instruction: 'Apex label',
    at: { x: apex.x, y: apex.y - 6 },
    text: 'O',
    align: 'middle',
    fontSize: 5,
  });
  builder.text({
    instruction: 'Slant annotation',
    at: { x: apex.x + 6, y: apex.y + slant / 2 },
    text: `L = ${fmt(slant)}mm`,
    fontSize: 4,
  });
  builder.text({
    instruction: 'Sector angle annotation',
    at: { x: apex.x, y: apex.y + slant + 10 },
    text: `Sector angle = (R/L)·360° = ${fmt((wedgeAngle * 180) / Math.PI, 2)}°`,
    align: 'middle',
    fontSize: 4.5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `The lateral surface of a cone of base diameter ${fmt(
      spec.sizeMm
    )}mm and height ${fmt(h)}mm develops as a circular sector whose radius equals the slant height L = √(R² + h²) = ${fmt(
      slant
    )}mm. The sector angle is (base circumference / L) × (180/π) = ${fmt(
      (wedgeAngle * 180) / Math.PI,
      2
    )}°. Dividing the base circumference into 12 parts and joining each division to the apex gives 12 equally-spaced generators on the development.`,
  };
}

/* ----- Helpers ----- */

function dimension(
  builder: StrokeBuilder,
  opts: { from: Pt; to: Pt; text: string; vertical?: boolean }
): void {
  builder.line({
    tool: '2H Pencil',
    instruction: 'Dimension line',
    from: opts.from,
    to: opts.to,
    layer: 'dimension',
  });
  const mid: Pt = { x: (opts.from.x + opts.to.x) / 2, y: (opts.from.y + opts.to.y) / 2 };
  builder.text({
    instruction: 'Dimension value',
    at: { x: mid.x + (opts.vertical ? -3 : 0), y: mid.y - (opts.vertical ? 0 : 2) },
    text: opts.text,
    align: opts.vertical ? 'end' : 'middle',
    fontSize: 4,
  });
}

function prismName(n: number): string {
  return n === 3 ? 'triangular' :
    n === 4 ? 'square' :
    n === 5 ? 'pentagonal' :
    n === 6 ? 'hexagonal' :
    n === 7 ? 'heptagonal' :
    n === 8 ? 'octagonal' : `${n}-sided`;
}

function label(spec: DevelopmentSpec): string {
  const sideOrDia = spec.shape === 'cone' || spec.shape === 'cylinder'
    ? `Ø${fmt(spec.sizeMm)}mm`
    : `side ${fmt(spec.sizeMm)}mm`;
  const h = spec.axisMm ?? spec.sizeMm * 1.5;
  if (spec.shape === 'cylinder' || spec.shape === 'cone') {
    return `${spec.shape} (${sideOrDia}, height ${fmt(h)}mm)`;
  }
  return `${prismName(spec.sides ?? 6)} ${spec.shape} (${sideOrDia}, axis ${fmt(h)}mm)`;
}

/* unused-marker */
export { deg2rad, regularPolygon, PAGE };
