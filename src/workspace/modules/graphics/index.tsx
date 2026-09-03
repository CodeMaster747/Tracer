import type { SolvedQuestion, Stroke } from '@/engines/types';
import { StrokeAnalysisPanel } from '@/components/canvas/StrokeAnalysisPanel';
import { ProgressPanel } from '@/components/canvas/ProgressPanel';
import { PaperSizeMenu } from '@/components/canvas/PaperSizeMenu';
import { StrokeCanvasContent } from '@/workspace/StrokeCanvasContent';
import type {
  Command,
  ModuleSlotProps,
  ModuleViewport,
  WorkspaceContext,
  WorkspaceModule,
} from '@/workspace/types';

/**
 * Engineering Graphics workspace module.
 *
 * Phase 1: a thin adapter that re-uses the existing drafting panels through
 * the WorkspaceModule contract. UX is identical to the pre-refactor canvas.
 * Phase 2+ will replace these slots with the redesigned drafting panels
 * (steps + tools + layers + snap on the left, full stroke inspector on the
 * right) without touching the shell.
 */

function inspectStroke(
  question: SolvedQuestion,
  currentStep: number,
  hoveredId: string | null,
  selectedId: string | null
): Stroke | null {
  const id =
    hoveredId ??
    selectedId ??
    (currentStep > 0 ? question.strokes[currentStep - 1]?.id ?? null : null);
  if (!id) return null;
  return question.strokes.find((s) => s.id === id) ?? null;
}

function DraftingLeftSidebar({ ctx }: ModuleSlotProps) {
  const hoveredId =
    ctx.hovered && ctx.hovered.kind === 'stroke' ? ctx.hovered.id : null;
  const selectedId =
    ctx.selection && ctx.selection.kind === 'stroke' ? ctx.selection.id : null;
  const stroke = inspectStroke(
    ctx.question,
    ctx.currentStep,
    hoveredId,
    selectedId
  );
  return <StrokeAnalysisPanel stroke={stroke} />;
}

function DraftingRightInspector({ ctx }: ModuleSlotProps) {
  return <ProgressPanel current={ctx.currentStep} total={ctx.totalSteps} />;
}

function DraftingToolbar({ ctx }: ModuleSlotProps) {
  return (
    <PaperSizeMenu
      paper={ctx.question.paper}
      onChange={(paper) => ctx.updateQuestion({ ...ctx.question, paper })}
    />
  );
}

function getViewport(q: SolvedQuestion): ModuleViewport {
  return {
    widthUnits: q.paper.widthMm,
    heightUnits: q.paper.heightMm,
    unitScale: 3,
    background: '#ffffff',
    showPaperEdge: true,
  };
}

function getCommands(ctx: WorkspaceContext): Command[] {
  const out: Command[] = [];
  // Surface distinct drafting tools as commands — clicking one scrubs to the
  // first stroke that uses that tool.
  const seen = new Set<string>();
  for (let i = 0; i < ctx.question.strokes.length; i++) {
    const s = ctx.question.strokes[i];
    if (!s.tool || seen.has(s.tool)) continue;
    seen.add(s.tool);
    const targetStep = s.order;
    out.push({
      id: `graphics.tool.${s.tool}`,
      label: `Tool: ${s.tool}`,
      hint: `step ${targetStep}`,
      group: 'Tools',
      icon: 'doc',
      action: (c) => c.setStep(targetStep),
    });
  }
  return out;
}

export const DraftingModule: WorkspaceModule = {
  id: 'graphics',
  displayName: 'Drafting',
  accent: { hex: '#2b55c0', label: 'drafting blue' },
  getViewport,
  getTotalSteps: (q) => q.strokes.length,
  getMetaLine: (q) => `${q.paper.widthMm} × ${q.paper.heightMm} mm`,
  LeftSidebar: DraftingLeftSidebar,
  RightInspector: DraftingRightInspector,
  ToolbarSlots: DraftingToolbar,
  CanvasContent: StrokeCanvasContent,
  getCommands,
};
