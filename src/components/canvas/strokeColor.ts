import type { Stroke } from '@/engines/types';

export type StrokeStatus = 'pending' | 'drawing' | 'done';

export function getStrokeStatus(stroke: Stroke, currentStep: number): StrokeStatus {
  if (stroke.order > currentStep) return 'pending';
  if (stroke.order === currentStep) return 'drawing';
  return 'done';
}

export interface StrokeColors {
  stroke: string;
  fill: string;
  opacity: number;
  strokeWidth: number;
}

const COLORS = {
  pending: '#b0b6be',
  drawing: '#2b55c0',
  active: '#2b55c0',
  accepting: '#177a4c',
  done: '#14171a',
  hover: '#5b7fd4',
};

export function getStrokeColors(
  stroke: Stroke,
  currentStep: number,
  hovered: boolean
): StrokeColors {
  const status = getStrokeStatus(stroke, currentStep);
  const isLabel = stroke.geometry.kind === 'text';

  let color: string;
  let opacity = 1;
  let width = isLabel ? 0 : 0.5;

  if (status === 'pending') {
    color = COLORS.pending;
    opacity = 0;
  } else if (status === 'drawing') {
    color = COLORS.drawing;
    width = isLabel ? 0 : 0.65;
  } else if (stroke.marker === 'accepting') {
    color = COLORS.accepting;
  } else if (stroke.marker === 'start') {
    color = COLORS.active;
  } else {
    color = isLabel ? '#14171a' : COLORS.done;
  }

  if (hovered && status !== 'pending') {
    color = COLORS.hover;
    width = isLabel ? 0 : 0.75;
  }

  return {
    stroke: color,
    fill: isLabel ? color : 'none',
    opacity,
    strokeWidth: width,
  };
}
