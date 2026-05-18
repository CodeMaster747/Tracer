import type { Command, WorkspaceContext } from './types';

/**
 * Commands that apply to every module — playback, step jumps, view.
 * Subjects add their own via WorkspaceModule.getCommands().
 */
export function buildCommonCommands(ctx: WorkspaceContext): Command[] {
  const out: Command[] = [];

  out.push({
    id: 'view.first-step',
    label: 'Go to first step',
    group: 'Playback',
    icon: 'view',
    action: (c) => c.setStep(0),
  });
  out.push({
    id: 'view.last-step',
    label: 'Go to last step',
    group: 'Playback',
    icon: 'view',
    action: (c) => c.setStep(c.totalSteps),
  });

  // One numbered "jump to step N" per stroke up to a cap — the palette caps
  // its results at 60 so we don't dump a thousand items into one group.
  const cap = Math.min(ctx.totalSteps, 50);
  for (let i = 1; i <= cap; i++) {
    const stroke = ctx.question.strokes[i - 1];
    const hint = stroke ? truncate(stroke.instruction, 60) : undefined;
    out.push({
      id: `view.step.${i}`,
      label: `Step ${i}`,
      hint,
      group: 'Steps',
      icon: 'step',
      action: (c) => c.setStep(i),
    });
  }

  return out;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
