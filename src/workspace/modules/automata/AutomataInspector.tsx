import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AutomataMeta, AutomataTransition } from '@/engines/types';
import { MonoStat, PanelSection } from '@/workspace/PanelSection';
import type { ModuleSlotProps, WorkspaceContext } from '@/workspace/types';
import { AUTOMATA_ACCENT } from './accent';

export function AutomataInspector({ ctx }: ModuleSlotProps) {
  const meta = ctx.question.meta?.kind === 'automata' ? ctx.question.meta : null;
  const stateName = pickStateName(ctx);

  return (
    <div>
      <header className="border-b border-border-subtle px-5 py-4">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
          State inspector
        </div>
      </header>

      <AnimatePresence mode="wait">
        {meta && stateName ? (
          <motion.div
            key={stateName}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14 }}
          >
            <StateDetails meta={meta} state={stateName} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 py-10 text-center text-xs text-text-muted"
          >
            {meta
              ? 'Hover or click a state on the canvas to inspect it.'
              : 'No machine data for this question.'}
          </motion.div>
        )}
      </AnimatePresence>

      {meta && <ProgressSummary meta={meta} ctx={ctx} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function pickStateName(ctx: WorkspaceContext): string | null {
  // Selections in the canvas use stroke ids today. State selection arrives
  // via the dedicated 'state' Selection variant once Phase 5 swaps the
  // automata canvas to a native graph renderer. For Phase 2 we honour the
  // 'state' kind if present so the inspector is wired and ready.
  if (ctx.hovered && ctx.hovered.kind === 'state') return ctx.hovered.id;
  if (ctx.selection && ctx.selection.kind === 'state') return ctx.selection.id;
  return null;
}

/* ------------------------------------------------------------------ */

function StateDetails({ meta, state }: { meta: AutomataMeta; state: string }) {
  const stats = useMemo(() => deriveStateStats(meta, state), [meta, state]);

  return (
    <div>
      <div className="px-5 py-4">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-muted">
          State
        </div>
        <div
          className="mt-1 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-sm text-text-primary"
          style={{
            borderColor: AUTOMATA_ACCENT + '55',
            background: AUTOMATA_ACCENT + '12',
          }}
        >
          {state}
        </div>
      </div>

      <PanelSection title="Properties" accent={AUTOMATA_ACCENT}>
        <MonoStat
          label="Start"
          value={stats.isStart ? 'yes' : 'no'}
          mono={false}
        />
        <MonoStat
          label="Accepting"
          value={stats.isAccepting ? 'yes' : 'no'}
          mono={false}
        />
        <MonoStat label="In-degree" value={stats.inDegree} />
        <MonoStat label="Out-degree" value={stats.outDegree} />
        <MonoStat
          label="Self-loops"
          value={stats.selfLoops}
        />
      </PanelSection>

      {stats.incoming.length > 0 && (
        <PanelSection title="Incoming" accent={AUTOMATA_ACCENT} collapsible>
          <TransitionList rows={stats.incoming} />
        </PanelSection>
      )}
      {stats.outgoing.length > 0 && (
        <PanelSection title="Outgoing" accent={AUTOMATA_ACCENT} collapsible>
          <TransitionList rows={stats.outgoing} />
        </PanelSection>
      )}
    </div>
  );
}

function TransitionList({ rows }: { rows: AutomataTransition[] }) {
  return (
    <ul className="space-y-1">
      {rows.map((t, i) => (
        <li
          key={i}
          className="flex items-center gap-2 font-mono text-[11.5px] tabular-nums"
        >
          <span className="text-text-secondary">{t.from}</span>
          <span className="text-text-muted">─{t.symbol}→</span>
          <span className="text-text-primary">{t.to}</span>
        </li>
      ))}
    </ul>
  );
}

interface StateStats {
  isStart: boolean;
  isAccepting: boolean;
  inDegree: number;
  outDegree: number;
  selfLoops: number;
  incoming: AutomataTransition[];
  outgoing: AutomataTransition[];
}

function deriveStateStats(meta: AutomataMeta, state: string): StateStats {
  const incoming = meta.transitions.filter((t) => t.to === state);
  const outgoing = meta.transitions.filter((t) => t.from === state);
  const selfLoops = meta.transitions.filter(
    (t) => t.from === state && t.to === state
  ).length;
  return {
    isStart: meta.start === state,
    isAccepting: meta.accepting.includes(state),
    inDegree: incoming.length,
    outDegree: outgoing.length,
    selfLoops,
    incoming,
    outgoing,
  };
}

/* ------------------------------------------------------------------ */

function ProgressSummary({
  meta,
  ctx,
}: {
  meta: AutomataMeta;
  ctx: WorkspaceContext;
}) {
  const pct =
    ctx.totalSteps > 0
      ? Math.min(100, Math.round((ctx.currentStep / ctx.totalSteps) * 100))
      : 0;
  return (
    <PanelSection title="Build progress" accent={AUTOMATA_ACCENT}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {meta.type} · {meta.states.length} states
        </span>
        <span className="font-mono text-xs tabular-nums text-text-primary">
          {ctx.currentStep} / {ctx.totalSteps}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: AUTOMATA_ACCENT,
          }}
        />
      </div>
      <div className="mt-1.5 text-[10.5px] text-text-muted">
        {pct}% rendered
      </div>
    </PanelSection>
  );
}
