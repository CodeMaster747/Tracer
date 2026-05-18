import type { SolvedQuestion } from '@/engines/types';
import { StrokeCanvasContent } from '@/workspace/StrokeCanvasContent';
import type {
  Command,
  ModuleViewport,
  WorkspaceContext,
  WorkspaceModule,
} from '@/workspace/types';
import { ControlSidebar } from './ControlSidebar';
import { ControlInspector } from './ControlInspector';

/**
 * Control Systems workspace module.
 *
 * The canvas continues to paint the engine-emitted strokes (block diagrams,
 * pole-zero maps, plots are all flattened to strokes today). Phase 3
 * replaces the surrounding panels with system-engineering specifics:
 * system info, transfer function, reduction tracker, stability + Routh,
 * signal-flow Mason decomposition, and a plot navigator. Phase 5 will
 * swap the stroke renderer for native draggable blocks, auto-routed
 * signal lines, and live plot tweens.
 */

function getViewport(q: SolvedQuestion): ModuleViewport {
  return {
    widthUnits: q.paper.widthMm,
    heightUnits: q.paper.heightMm,
    unitScale: 3,
    background: '#ffffff',
    showPaperEdge: true,
  };
}

function getMetaLine(q: SolvedQuestion): string {
  if (q.meta?.kind === 'control') {
    const m = q.meta;
    if (m.tf) return `${m.topic} · order ${m.tf.order} · type ${m.tf.systemType}`;
    return m.topic;
  }
  return `${q.paper.widthMm} × ${q.paper.heightMm} mm`;
}

function getCommands(ctx: WorkspaceContext): Command[] {
  const meta = ctx.question.meta?.kind === 'control' ? ctx.question.meta : null;
  if (!meta) return [];
  const out: Command[] = [];

  // Plot navigator entries — same scrub-target heuristic the inspector uses.
  if (meta.plots) {
    meta.plots.forEach((plot, i) => {
      const target =
        ctx.totalSteps > 0
          ? Math.round(((i + 1) / meta.plots!.length) * ctx.totalSteps)
          : 0;
      out.push({
        id: `control.plot.${i}`,
        label: `Plot: ${plot.title}`,
        hint: plot.kind.replace(/-/g, ' '),
        group: 'Plots',
        icon: 'plot',
        action: (c) => c.setStep(target),
      });
    });
  }

  // Reduction steps as palette entries.
  if (meta.reduction) {
    meta.reduction.forEach((step, i) => {
      const target =
        ctx.totalSteps > 0
          ? Math.round(((i + 1) / meta.reduction!.length) * ctx.totalSteps)
          : 0;
      out.push({
        id: `control.reduction.${i}`,
        label: `Reduction ${i + 1}`,
        hint: truncate(step.description, 60),
        group: 'Reduction',
        icon: 'doc',
        action: (c) => c.setStep(target),
      });
    });
  }

  return out;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

export const SystemsModule: WorkspaceModule = {
  id: 'control',
  displayName: 'Control',
  accent: { hex: '#7EC4A6', label: 'signal green' },
  getViewport,
  getTotalSteps: (q) => q.strokes.length,
  getMetaLine,
  LeftSidebar: ControlSidebar,
  RightInspector: ControlInspector,
  CanvasContent: StrokeCanvasContent,
  getCommands,
};
