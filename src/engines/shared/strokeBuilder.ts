import type { Pt, Stroke, StrokeGeometry, DrawingTool } from '@/engines/types';

/**
 * Helper that builds an ordered list of strokes with auto-numbering.
 */
export class StrokeBuilder {
  private strokes: Stroke[] = [];
  private order = 1;

  add(opts: {
    tool: DrawingTool;
    instruction: string;
    geometry: StrokeGeometry;
    startMm: Pt;
    endMm: Pt;
    radiusMm?: number;
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
    doubled?: boolean;
  }): Stroke {
    const stroke: Stroke = {
      id: `s${this.order}`,
      order: this.order,
      ...opts,
    };
    this.strokes.push(stroke);
    this.order++;
    return stroke;
  }

  /** Convenience helpers for common shapes */
  line(opts: {
    tool: DrawingTool;
    instruction: string;
    from: Pt;
    to: Pt;
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
  }): Stroke {
    return this.add({
      ...opts,
      geometry: { kind: 'line', x1: opts.from.x, y1: opts.from.y, x2: opts.to.x, y2: opts.to.y },
      startMm: opts.from,
      endMm: opts.to,
    });
  }

  circle(opts: {
    tool: DrawingTool;
    instruction: string;
    center: Pt;
    radius: number;
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
  }): Stroke {
    return this.add({
      ...opts,
      geometry: { kind: 'circle', cx: opts.center.x, cy: opts.center.y, r: opts.radius },
      startMm: opts.center,
      endMm: opts.center,
      radiusMm: opts.radius,
    });
  }

  arc(opts: {
    tool: DrawingTool;
    instruction: string;
    center: Pt;
    radius: number;
    startAngle: number;
    endAngle: number;
    anticlockwise?: boolean;
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
  }): Stroke {
    const startPt: Pt = {
      x: opts.center.x + opts.radius * Math.cos(opts.startAngle),
      y: opts.center.y + opts.radius * Math.sin(opts.startAngle),
    };
    const endPt: Pt = {
      x: opts.center.x + opts.radius * Math.cos(opts.endAngle),
      y: opts.center.y + opts.radius * Math.sin(opts.endAngle),
    };
    return this.add({
      tool: opts.tool,
      instruction: opts.instruction,
      geometry: {
        kind: 'arc',
        cx: opts.center.x,
        cy: opts.center.y,
        r: opts.radius,
        startAngle: opts.startAngle,
        endAngle: opts.endAngle,
        anticlockwise: opts.anticlockwise,
      },
      startMm: startPt,
      endMm: endPt,
      radiusMm: opts.radius,
      layer: opts.layer,
      marker: opts.marker,
    });
  }

  arrow(opts: {
    tool: DrawingTool;
    instruction: string;
    from: Pt;
    to: Pt;
    headSize?: number;
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
  }): Stroke {
    return this.add({
      ...opts,
      geometry: {
        kind: 'arrow',
        x1: opts.from.x,
        y1: opts.from.y,
        x2: opts.to.x,
        y2: opts.to.y,
        headSize: opts.headSize ?? 4,
      },
      startMm: opts.from,
      endMm: opts.to,
    });
  }

  text(opts: {
    tool?: DrawingTool;
    instruction: string;
    at: Pt;
    text: string;
    fontSize?: number;
    align?: 'start' | 'middle' | 'end';
    baseline?: 'auto' | 'middle' | 'hanging';
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
  }): Stroke {
    return this.add({
      tool: opts.tool ?? 'HB Pencil',
      instruction: opts.instruction,
      geometry: {
        kind: 'text',
        x: opts.at.x,
        y: opts.at.y,
        text: opts.text,
        align: opts.align,
        baseline: opts.baseline,
        fontSize: opts.fontSize,
      },
      startMm: opts.at,
      endMm: opts.at,
      layer: opts.layer ?? 'label',
      marker: opts.marker,
    });
  }

  curve(opts: {
    tool: DrawingTool;
    instruction: string;
    points: Pt[];
    closed?: boolean;
    layer?: Stroke['layer'];
    marker?: Stroke['marker'];
  }): Stroke {
    if (opts.points.length < 2) {
      throw new Error('curve requires >= 2 points');
    }
    return this.add({
      tool: opts.tool,
      instruction: opts.instruction,
      geometry: { kind: 'curve', points: opts.points, closed: opts.closed },
      startMm: opts.points[0],
      endMm: opts.points[opts.points.length - 1],
      layer: opts.layer,
      marker: opts.marker,
    });
  }

  build(): Stroke[] {
    return this.strokes.slice();
  }
}
