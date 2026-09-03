import type { PaperSize, PaperSpec, Pt, Stroke, StrokeGeometry } from '@/engines/types';
import { paperSpec } from '@/engines/types';

/**
 * Last line of defence against drawings that leave the sheet.
 *
 * The canvas renders strokes inside `viewBox="0 0 widthMm heightMm"`, so anything outside
 * the paper is silently clipped — on screen and in the PNG/PDF export. Constructions are
 * laid out against the fixed A3 page in `layout.ts`, and an unusual set of dimensions can
 * still push a view past an edge.
 *
 * The pass never rescales: a drawing that claims "80mm" must measure 80mm on the sheet.
 * It only moves the drawing, and grows the sheet when moving is not enough.
 */

const MARGIN_MM = 10;

/** Sheets we are willing to promote a drawing to, smallest first. */
const LARGER_SIZES: PaperSize[] = ['A2'];

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function fitToSheet(
  strokes: Stroke[],
  paper: PaperSpec
): { strokes: Stroke[]; paper: PaperSpec } {
  const b = boundsOf(strokes);
  // Nothing measurable, or everything already on the sheet: hand back the inputs untouched.
  if (!b) return { strokes, paper };
  if (b.minX >= 0 && b.minY >= 0 && b.maxX <= paper.widthMm && b.maxY <= paper.heightMm) {
    return { strokes, paper };
  }

  const contentW = b.maxX - b.minX;
  const contentH = b.maxY - b.minY;

  // 1. Try to slide the drawing back onto the sheet it already has.
  const shift = shiftToFit(b, paper, contentW, contentH);
  if (shift) return { strokes: translateStrokes(strokes, shift.dx, shift.dy), paper };

  // 2. Too big to slide — promote to a larger sheet and centre the drawing on it.
  for (const size of LARGER_SIZES) {
    for (const orientation of [paper.orientation, flip(paper.orientation)] as const) {
      const bigger = paperSpec(size, orientation);
      if (
        contentW <= bigger.widthMm - 2 * MARGIN_MM &&
        contentH <= bigger.heightMm - 2 * MARGIN_MM
      ) {
        const dx = (bigger.widthMm - contentW) / 2 - b.minX;
        const dy = (bigger.heightMm - contentH) / 2 - b.minY;
        return { strokes: translateStrokes(strokes, dx, dy), paper: bigger };
      }
    }
  }

  // 3. Larger than any sheet we offer. Scaling would falsify the dimensions the drawing
  //    asserts, so leave it alone rather than lie about it.
  return { strokes, paper };
}

function flip(o: PaperSpec['orientation']): PaperSpec['orientation'] {
  return o === 'landscape' ? 'portrait' : 'landscape';
}

/** Offset that brings the content inside the sheet, or null if it cannot fit. */
function shiftToFit(
  b: Bounds,
  paper: PaperSpec,
  contentW: number,
  contentH: number
): { dx: number; dy: number } | null {
  if (contentW > paper.widthMm || contentH > paper.heightMm) return null;
  return { dx: axisShift(b.minX, b.maxX, paper.widthMm), dy: axisShift(b.minY, b.maxY, paper.heightMm) };
}

/**
 * Shift along one axis: pull the content inside, keeping the requested margin where the
 * sheet has room for it, and never pushing the far edge back out.
 */
function axisShift(min: number, max: number, limit: number): number {
  const slack = limit - (max - min);
  const margin = Math.min(MARGIN_MM, slack / 2);
  if (min < margin) return margin - min;
  if (max > limit - margin) return limit - margin - max;
  return 0;
}

function boundsOf(strokes: Stroke[]): Bounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    for (const p of extentPoints(s.geometry)) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, maxX, minY, maxY };
}

/** The points a stroke has to keep on the sheet. */
function extentPoints(g: StrokeGeometry): Pt[] {
  switch (g.kind) {
    case 'line':
    case 'arrow':
      return [
        { x: g.x1, y: g.y1 },
        { x: g.x2, y: g.y2 },
      ];
    case 'circle':
    case 'arc':
      return [
        { x: g.cx - g.r, y: g.cy - g.r },
        { x: g.cx + g.r, y: g.cy + g.r },
      ];
    case 'curve':
    case 'polygon':
      return g.points;
    case 'text':
      return [{ x: g.x, y: g.y }];
  }
}

/**
 * Move every stroke by (dx, dy). Returns new objects: `StrokeBuilder.build()` hands out a
 * shallow copy and curve geometry holds the builder's own `Pt` objects, so mutating in
 * place would reach back into the caller's data.
 *
 * `radiusMm`, `r`, `fontSize` and `headSize` are all translation-invariant and stay as they
 * are; `startMm`/`endMm` mirror the geometry for the stroke inspector and must move with it.
 */
function translateStrokes(strokes: Stroke[], dx: number, dy: number): Stroke[] {
  if (dx === 0 && dy === 0) return strokes;
  const move = (p: Pt): Pt => ({ x: p.x + dx, y: p.y + dy });
  return strokes.map((s) => ({
    ...s,
    geometry: translateGeometry(s.geometry, dx, dy),
    startMm: move(s.startMm),
    endMm: move(s.endMm),
  }));
}

function translateGeometry(g: StrokeGeometry, dx: number, dy: number): StrokeGeometry {
  switch (g.kind) {
    case 'line':
    case 'arrow':
      return { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy };
    case 'circle':
    case 'arc':
      return { ...g, cx: g.cx + dx, cy: g.cy + dy };
    case 'curve':
    case 'polygon':
      return { ...g, points: g.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case 'text':
      return { ...g, x: g.x + dx, y: g.y + dy };
  }
}
