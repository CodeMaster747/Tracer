import type { StrokeGeometry } from '@/engines/types';

/**
 * Analytical path length of a stroke geometry in user units (mm).
 * Used to set stroke-dasharray for draw-on reveal animation.
 *
 * The returned length is an estimate good enough for animation: text has no
 * stroke path, so 0 is returned (the animation layer skips text strokes).
 */
export function computeStrokeLength(g: StrokeGeometry): number {
  switch (g.kind) {
    case 'line':
      return Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    case 'circle':
      return 2 * Math.PI * g.r;
    case 'arc':
      return g.r * Math.abs(g.endAngle - g.startAngle);
    case 'curve':
      return polylineLength(g.points, g.closed);
    case 'polygon':
      return polylineLength(g.points, true);
    case 'arrow':
      // The shaft accounts for the bulk of the path; the head is filled, not
      // stroked, and contributes negligibly to reveal length.
      return Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    case 'text':
      return 0;
  }
}

function polylineLength(points: { x: number; y: number }[], closed?: boolean): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (closed) {
    const a = points[0];
    const b = points[points.length - 1];
    total += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return total;
}
