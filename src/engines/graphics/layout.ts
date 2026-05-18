import type { Pt } from '@/engines/types';
import type { StrokeBuilder } from '@/engines/shared/strokeBuilder';

/**
 * Default A3 landscape paper origin for orthographic projections.
 * The XY reference line sits at the vertical center; HP is below, VP is above.
 */
export const PAGE = {
  widthMm: 420,
  heightMm: 297,
};

export function xyLineY(): number {
  return PAGE.heightMm / 2;
}

export function pageCenterX(): number {
  return PAGE.widthMm / 2;
}

export function pageCenter(): Pt {
  return { x: pageCenterX(), y: PAGE.heightMm / 2 };
}

/** Project a (above-HP, in-front-of-VP) pair to first-angle paper-mm coordinates */
export function firstAnglePoint(xRef: number, aboveHpMm: number, beforeVpMm: number) {
  const xy = xyLineY();
  return {
    front: { x: xRef, y: xy - aboveHpMm },
    top: { x: xRef, y: xy + beforeVpMm },
  };
}

/** Project a (above-HP, in-front-of-VP) pair to third-angle paper-mm coordinates */
export function thirdAnglePoint(xRef: number, aboveHpMm: number, beforeVpMm: number) {
  const xy = xyLineY();
  return {
    front: { x: xRef, y: xy + aboveHpMm },
    top: { x: xRef, y: xy - beforeVpMm },
  };
}

/** Map vertical 3D height to 'y above XY' (positive = above HP region of VP plane). */
export function fvPoint(xRef: number, heightMm: number, angle: 'first' | 'third' = 'first'): Pt {
  const xy = xyLineY();
  return angle === 'first'
    ? { x: xRef, y: xy - heightMm }
    : { x: xRef, y: xy + heightMm };
}

/** Map horizontal 3D depth (distance from VP) to 'y below XY' in the TV region. */
export function tvPoint(xRef: number, depthMm: number, angle: 'first' | 'third' = 'first'): Pt {
  const xy = xyLineY();
  return angle === 'first'
    ? { x: xRef, y: xy + depthMm }
    : { x: xRef, y: xy - depthMm };
}

/** Distance helpers in mm */
export const M = {
  short: 5,
  medium: 10,
  long: 20,
};

/* ----- Reusable drawing primitives ----- */

interface XYOptions {
  /** Left margin in mm (default 50) */
  leftMargin?: number;
  /** Right margin in mm (default 50) */
  rightMargin?: number;
  /** Custom label */
  label?: boolean;
}

/** Draws the standard XY reference line with labels at both ends. */
export function drawXYReference(builder: StrokeBuilder, opts: XYOptions = {}): void {
  const xy = xyLineY();
  const left = opts.leftMargin ?? 50;
  const right = opts.rightMargin ?? 50;
  builder.line({
    tool: 'T-Square',
    instruction: 'Draw the reference line XY',
    from: { x: left, y: xy },
    to: { x: PAGE.widthMm - right, y: xy },
    layer: 'final',
  });
  if (opts.label !== false) {
    builder.text({
      instruction: 'Label X (left end of reference line)',
      at: { x: left - 5, y: xy + 1 },
      text: 'X',
      align: 'end',
      baseline: 'middle',
      fontSize: 5,
    });
    builder.text({
      instruction: 'Label Y (right end of reference line)',
      at: { x: PAGE.widthMm - right + 5, y: xy + 1 },
      text: 'Y',
      align: 'start',
      baseline: 'middle',
      fontSize: 5,
    });
  }
}

/** Draws the page title at standard position. */
export function drawTitle(builder: StrokeBuilder, text: string, y: number = 25): void {
  builder.text({
    instruction: 'Title',
    at: { x: PAGE.widthMm / 2, y },
    text,
    align: 'middle',
    fontSize: 6.5,
  });
}
