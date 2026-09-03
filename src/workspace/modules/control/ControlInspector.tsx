import type { ControlMeta, ControlPlotKind } from '@/engines/types';
import { EmptyHint, PanelSection } from '@/workspace/PanelSection';
import type { ModuleSlotProps, WorkspaceContext } from '@/workspace/types';
import { cn } from '@/lib/utils';
import { CONTROL_ACCENT } from './accent';

export function ControlInspector({ ctx }: ModuleSlotProps) {
  const meta = ctx.question.meta?.kind === 'control' ? ctx.question.meta : null;

  return (
    <div>
      <header className="border-b border-border-subtle px-5 py-4">
        <div className="u-label">
          Plots & progress
        </div>
      </header>

      {meta?.plots && meta.plots.length > 0 ? (
        <PlotList ctx={ctx} plots={meta.plots} />
      ) : (
        <EmptyHint>
          {meta
            ? 'No plots in this analysis.'
            : 'No structured analysis data.'}
        </EmptyHint>
      )}

      <ProgressSummary ctx={ctx} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PlotList({
  ctx,
  plots,
}: {
  ctx: WorkspaceContext;
  plots: NonNullable<ControlMeta['plots']>;
}) {
  return (
    <PanelSection title="Plots" accent={CONTROL_ACCENT}>
      <ul className="space-y-1.5">
        {plots.map((plot, i) => {
          // Distribute scrub targets evenly across totalSteps as a simple
          // first-cut. Phase 5 will replace this with per-section ranges
          // emitted by the renderer.
          const target =
            ctx.totalSteps > 0
              ? Math.round(((i + 1) / plots.length) * ctx.totalSteps)
              : 0;
          return (
            <li key={i}>
              <button
                onClick={() => ctx.setStep(target)}
                className="group flex w-full items-center gap-2.5 rounded-md border border-border-subtle bg-ink/[0.02] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-ink/[0.04]"
                title="Scrub canvas to this plot"
              >
                <PlotGlyph kind={plot.kind} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-text-primary">
                    {plot.title}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted">
                    {plot.kind.replace(/-/g, ' ')}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </PanelSection>
  );
}

function PlotGlyph({ kind }: { kind: ControlPlotKind }) {
  const stroke = CONTROL_ACCENT;
  const base = 'h-7 w-7 flex-shrink-0';
  switch (kind) {
    case 'bode-magnitude':
    case 'bode-phase':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <path
            d="M3 22 L10 22 L14 14 L25 6"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
          <path d="M3 26 L25 26" stroke="#3a3a44" strokeWidth="0.5" />
        </svg>
      );
    case 'pole-zero':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <path d="M14 4 V24" stroke="#3a3a44" strokeWidth="0.5" />
          <path d="M4 14 H24" stroke="#3a3a44" strokeWidth="0.5" />
          <path
            d="M8 10 L12 14 M12 10 L8 14"
            stroke={stroke}
            strokeWidth="1.3"
          />
          <circle cx="18" cy="12" r="1.6" fill="none" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case 'polar':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <circle cx="14" cy="14" r="9" fill="none" stroke="#3a3a44" strokeWidth="0.5" />
          <path
            d="M14 14 C 17 8, 22 10, 23 14 C 22 18, 17 20, 14 14"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'root-locus':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <path d="M14 4 V24" stroke="#3a3a44" strokeWidth="0.5" />
          <path d="M4 14 H24" stroke="#3a3a44" strokeWidth="0.5" />
          <path
            d="M8 8 C 12 14, 16 14, 22 18"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'time-response':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <path
            d="M3 22 C 8 22, 9 6, 14 6 C 19 6, 25 6, 25 6"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
          <path d="M3 22 L25 22" stroke="#3a3a44" strokeWidth="0.5" />
        </svg>
      );
    case 'block-diagram':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <rect x="5" y="11" width="6" height="6" fill="none" stroke={stroke} strokeWidth="1.2" />
          <rect x="17" y="11" width="6" height="6" fill="none" stroke={stroke} strokeWidth="1.2" />
          <path d="M11 14 L17 14" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case 'signal-flow-graph':
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <circle cx="6" cy="14" r="1.6" fill={stroke} />
          <circle cx="14" cy="14" r="1.6" fill={stroke} />
          <circle cx="22" cy="14" r="1.6" fill={stroke} />
          <path d="M7.5 14 L12.5 14 M15.5 14 L20.5 14" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 28 28" className={base}>
          <rect x="6" y="6" width="16" height="16" fill="none" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */

function ProgressSummary({ ctx }: { ctx: WorkspaceContext }) {
  const pct =
    ctx.totalSteps > 0
      ? Math.min(100, Math.round((ctx.currentStep / ctx.totalSteps) * 100))
      : 0;
  return (
    <PanelSection title="Render progress" accent={CONTROL_ACCENT}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">Strokes rendered</span>
        <span className="font-mono text-xs tabular-nums text-text-primary">
          {ctx.currentStep} / {ctx.totalSteps}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink/[0.04]">
        <div
          className={cn('h-full transition-all duration-300 ease-out')}
          style={{ width: `${pct}%`, background: CONTROL_ACCENT }}
        />
      </div>
      <div className="mt-1.5 text-[10.5px] text-text-muted">{pct}% complete</div>
    </PanelSection>
  );
}
