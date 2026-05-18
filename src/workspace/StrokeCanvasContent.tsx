import { StrokeShape } from '@/components/canvas/StrokeShape';
import type { ModuleSlotProps } from './types';

/**
 * Default canvas content that paints each stroke from the question.
 * Hover/click are routed through the shell's selection state using a
 * `stroke` Selection. Graphics, automata, and (for now) control all use
 * this — Phase 5 will swap in native renderers for the non-drafting
 * modules.
 */
export function StrokeCanvasContent({ ctx }: ModuleSlotProps) {
  const { question, currentStep, hovered, setHovered, selection, setSelection } =
    ctx;
  const hoveredId = hovered && hovered.kind === 'stroke' ? hovered.id : null;
  const selectedId =
    selection && selection.kind === 'stroke' ? selection.id : null;

  return (
    <>
      {question.strokes.map((s) => (
        <g key={s.id} data-stroke-hit>
          <StrokeShape
            stroke={s}
            currentStep={currentStep}
            hovered={hoveredId === s.id}
            onHover={(id) =>
              setHovered(id ? { kind: 'stroke', id } : null)
            }
            onClick={(id) =>
              setSelection(selectedId === id ? null : { kind: 'stroke', id })
            }
          />
        </g>
      ))}
    </>
  );
}
