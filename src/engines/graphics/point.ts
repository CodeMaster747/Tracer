import type { Stroke, PaperSpec } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { PAGE, pageCenterX, xyLineY, firstAnglePoint, thirdAnglePoint } from './layout';

export type Quadrant = 1 | 2 | 3 | 4;
export type ProjectionAngle = 'first' | 'third';

export interface PointSpec {
  name: string;
  /** signed mm: +above HP, -below HP */
  hp: number;
  /** signed mm: +in front of VP, -behind VP */
  vp: number;
  /** Distance from PP (profile plane). Optional; only required for 3-view problems */
  ppMm?: number;
  /** Reference x position on the page; if absent, uses page center */
  xRef?: number;
}

export interface PointProjectionResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

export function buildPointProjection(
  point: PointSpec,
  angle: ProjectionAngle = 'first'
): PointProjectionResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  const xy = xyLineY();
  const xRef = point.xRef ?? pageCenterX();

  // Title
  const fovTxt = `${Math.abs(point.hp)}mm ${point.hp >= 0 ? 'above' : 'below'} HP, ${Math.abs(point.vp)}mm ${point.vp >= 0 ? 'in front of' : 'behind'} VP`;
  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y: 25 },
    text: `Point ${point.name}: ${fovTxt} (${angle === 'first' ? '1st' : '3rd'}-angle projection)`,
    align: 'middle',
    fontSize: 6.5,
  });

  // XY line
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the reference line XY (horizontal)',
    from: { x: 50, y: xy },
    to: { x: PAGE.widthMm - 50, y: xy },
    layer: 'final',
  });
  builder.text({
    instruction: 'Label X (left end)',
    at: { x: 45, y: xy + 1 },
    text: 'X',
    align: 'end',
    baseline: 'middle',
    fontSize: 5,
  });
  builder.text({
    instruction: 'Label Y (right end)',
    at: { x: PAGE.widthMm - 45, y: xy + 1 },
    text: 'Y',
    align: 'start',
    baseline: 'middle',
    fontSize: 5,
  });

  // Compute the two views
  const projector =
    angle === 'first'
      ? firstAnglePoint(xRef, point.hp, point.vp)
      : thirdAnglePoint(xRef, point.hp, point.vp);

  // Plot top view (a)
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Mark top view '${point.name.toLowerCase()}' at ${Math.abs(point.vp)}mm ${
      point.vp >= 0 ? 'below' : 'above'
    } XY (point ${point.vp >= 0 ? 'in front of' : 'behind'} VP)`,
    center: projector.top,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: `Label top view '${point.name.toLowerCase()}'`,
    at: { x: projector.top.x + 4, y: projector.top.y + 1 },
    text: point.name.toLowerCase(),
    align: 'start',
    baseline: 'middle',
    fontSize: 5,
  });

  // Plot front view (a')
  builder.circle({
    tool: 'HB Pencil',
    instruction: `Mark front view ${point.name.toLowerCase()}' at ${Math.abs(point.hp)}mm ${
      point.hp >= 0 ? 'above' : 'below'
    } XY (point ${point.hp >= 0 ? 'above' : 'below'} HP)`,
    center: projector.front,
    radius: 0.8,
    layer: 'final',
  });
  builder.text({
    instruction: `Label front view ${point.name.toLowerCase()}'`,
    at: { x: projector.front.x + 4, y: projector.front.y },
    text: `${point.name.toLowerCase()}'`,
    align: 'start',
    baseline: 'middle',
    fontSize: 5,
  });

  // Projector connecting both views
  const minY = Math.min(projector.front.y, projector.top.y);
  const maxY = Math.max(projector.front.y, projector.top.y);
  builder.line({
    tool: '2H Pencil',
    instruction: 'Draw the vertical projector connecting both views',
    from: { x: xRef, y: minY },
    to: { x: xRef, y: maxY },
    layer: 'construction',
  });

  // Distance dimensions
  if (point.hp !== 0) {
    builder.line({
      tool: '2H Pencil',
      instruction: `Indicate distance ${Math.abs(point.hp)}mm from XY`,
      from: { x: xRef + 8, y: xy },
      to: { x: xRef + 8, y: projector.front.y },
      layer: 'dimension',
    });
    builder.text({
      instruction: `Label distance ${Math.abs(point.hp)}mm`,
      at: { x: xRef + 11, y: (xy + projector.front.y) / 2 },
      text: `${Math.abs(point.hp)}`,
      align: 'start',
      baseline: 'middle',
      fontSize: 4,
    });
  }
  if (point.vp !== 0) {
    builder.line({
      tool: '2H Pencil',
      instruction: `Indicate distance ${Math.abs(point.vp)}mm from XY`,
      from: { x: xRef + 8, y: xy },
      to: { x: xRef + 8, y: projector.top.y },
      layer: 'dimension',
    });
    builder.text({
      instruction: `Label distance ${Math.abs(point.vp)}mm`,
      at: { x: xRef + 11, y: (xy + projector.top.y) / 2 },
      text: `${Math.abs(point.vp)}`,
      align: 'start',
      baseline: 'middle',
      fontSize: 4,
    });
  }

  const summary = buildPointSummary(point, angle);

  return { strokes: builder.build(), paper, summary };
}

function buildPointSummary(p: PointSpec, angle: ProjectionAngle): string {
  const aboveBelow = p.hp >= 0 ? 'above' : 'below';
  const frontBehind = p.vp >= 0 ? 'in front of' : 'behind';
  const quadrant = whichQuadrant(p);
  const angleName = angle === 'first' ? '1st-angle' : '3rd-angle';

  return [
    `Point ${p.name} lies ${Math.abs(p.hp)}mm ${aboveBelow} HP and ${Math.abs(p.vp)}mm ${frontBehind} VP — this places it in the ${ordinal(quadrant)} quadrant.`,
    `In ${angleName} projection, the front view ${p.name.toLowerCase()}' is drawn ${Math.abs(p.hp)}mm ${
      angle === 'first' ? aboveBelow : oppositeUpDown(aboveBelow)
    } the XY line on the VP, and the top view ${p.name.toLowerCase()} is drawn ${Math.abs(p.vp)}mm ${
      angle === 'first' ? oppositeFB(frontBehind) : frontBehind === 'in front of' ? 'above' : 'below'
    } the XY line on the HP.`,
    `Both views share the same horizontal x-coordinate and are connected by a vertical projector.`,
  ].join(' ');
}

function whichQuadrant(p: PointSpec): Quadrant {
  if (p.hp >= 0 && p.vp >= 0) return 1;
  if (p.hp >= 0 && p.vp < 0) return 2;
  if (p.hp < 0 && p.vp < 0) return 3;
  return 4;
}

function ordinal(n: number): string {
  return ['', 'first', 'second', 'third', 'fourth'][n] ?? `${n}th`;
}

function oppositeUpDown(s: string): string {
  return s === 'above' ? 'below' : 'above';
}

function oppositeFB(s: string): string {
  // Convert "in front of" → "below XY"; "behind" → "above XY"
  return s === 'in front of' ? 'below' : 'above';
}
