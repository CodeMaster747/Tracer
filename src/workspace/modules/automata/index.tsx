import type { SolvedQuestion } from '@/engines/types';
import { StrokeCanvasContent } from '@/workspace/StrokeCanvasContent';
import type {
  Command,
  ModuleViewport,
  WorkspaceContext,
  WorkspaceModule,
} from '@/workspace/types';
import { AutomataSidebar } from './AutomataSidebar';
import { AutomataInspector } from './AutomataInspector';

/**
 * Automata Theory workspace module.
 *
 * The canvas still renders the engine-emitted strokes (the same graph
 * drawing produced by `renderDocument`). Phase 2 replaces the surrounding
 * panels: machine info, transition table, simulation trace, conversions,
 * and a state inspector — all sourced from `question.meta` populated by
 * the engine. Phase 5 will swap the stroke renderer for a native graph
 * renderer that supports curved transitions, edge labels, and animated
 * traversal highlighting driven by the playback clock.
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
  if (q.meta?.kind === 'automata') {
    const m = q.meta;
    return `${m.type} · ${m.states.length} states · |Σ|=${m.alphabet.length}`;
  }
  return `${q.paper.widthMm} × ${q.paper.heightMm} mm`;
}

function getCommands(ctx: WorkspaceContext): Command[] {
  const meta =
    ctx.question.meta?.kind === 'automata' ? ctx.question.meta : null;
  if (!meta) return [];
  const out: Command[] = [];

  // Each state becomes a selection command — wires the inspector to focus
  // that state. Phase 5's native renderer will also visually highlight it.
  for (const state of meta.states) {
    const incoming = meta.transitions.filter((t) => t.to === state).length;
    const outgoing = meta.transitions.filter((t) => t.from === state).length;
    out.push({
      id: `automata.state.${state}`,
      label: `Select state ${state}`,
      hint: `in ${incoming} · out ${outgoing}`,
      group: 'States',
      icon: 'doc',
      action: (c) => c.setSelection({ kind: 'state', id: state }),
    });
  }

  // Conversion suggestions — copy a prompt to clipboard for re-ask.
  const conversions: { label: string; prompt: string }[] = [];
  if (meta.type === 'NFA' || meta.type === 'ε-NFA') {
    conversions.push({
      label: 'Convert to DFA (subset construction)',
      prompt: 'convert this NFA to a DFA',
    });
  }
  if (meta.type === 'DFA') {
    conversions.push({
      label: 'Minimize DFA',
      prompt: 'minimize this DFA',
    });
    conversions.push({
      label: 'Convert to regex',
      prompt: 'convert this DFA to a regex',
    });
  }
  if (meta.type === 'Mealy') {
    conversions.push({
      label: 'Convert Mealy to Moore',
      prompt: 'convert mealy to moore',
    });
  }
  if (meta.type === 'Moore') {
    conversions.push({
      label: 'Convert Moore to Mealy',
      prompt: 'convert moore to mealy',
    });
  }
  for (const conv of conversions) {
    out.push({
      id: `automata.conv.${conv.label}`,
      label: conv.label,
      hint: 'copy prompt',
      group: 'Conversions',
      icon: 'convert',
      action: async () => {
        try {
          await navigator.clipboard.writeText(conv.prompt);
        } catch {
          /* ignore */
        }
      },
    });
  }

  return out;
}

export const StateMachineModule: WorkspaceModule = {
  id: 'automata',
  displayName: 'Automata',
  accent: { hex: '#7DA9E7', label: 'slate blue' },
  getViewport,
  getTotalSteps: (q) => q.strokes.length,
  getMetaLine,
  LeftSidebar: AutomataSidebar,
  RightInspector: AutomataInspector,
  CanvasContent: StrokeCanvasContent,
  getCommands,
};
