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
  pending: '#3a3a44',
  drawing: '#ef4444',
  active: '#3b82f6',
  accepting: '#10b981',
  done: '#1f2937',
  hover: '#a18aff',
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
    color = isLabel ? '#0a0a0a' : COLORS.done;
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
