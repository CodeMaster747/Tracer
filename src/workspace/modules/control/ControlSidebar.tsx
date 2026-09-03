import type { ControlMeta } from '@/engines/types';
import { Headline, MonoStat, PanelSection } from '@/workspace/PanelSection';
import { ContentBlocks } from '@/workspace/ContentBlocks';
import type { ModuleSlotProps } from '@/workspace/types';
import { cn } from '@/lib/utils';
import { CONTROL_ACCENT } from './accent';

export function ControlSidebar({ ctx }: ModuleSlotProps) {
  const meta = ctx.question.meta?.kind === 'control' ? ctx.question.meta : null;

  if (!meta) {
    return (
      <div>
        <Headline
          title={ctx.question.title}
          summary={ctx.question.summary}
          accent={CONTROL_ACCENT}
        />
      </div>
    );
  }

  return (
    <div>
      <Headline
        title={meta.headline?.title || ctx.question.title}
        summary={meta.headline?.summary || ctx.question.summary}
        accent={CONTROL_ACCENT}
      />
      <SystemInfoSection meta={meta} />
      {meta.tf && <TfSection meta={meta} />}
      {meta.reduction && meta.reduction.length > 0 && (
        <ReductionSection meta={meta} ctx={ctx} />
      )}
      {(meta.stability || meta.routh) && <StabilitySection meta={meta} />}
      {meta.mason && <MasonSection meta={meta} />}
      {meta.content && meta.content.length > 0 && (
        <ContentBlocks blocks={meta.content} accent={CONTROL_ACCENT} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SystemInfoSection({ meta }: { meta: ControlMeta }) {
  const tf = meta.tf;
  return (
    <PanelSection title="System" accent={CONTROL_ACCENT}>
      <MonoStat label="Topic" value={meta.topic} mono={false} />
      {tf && (
        <>
          <MonoStat label="Order" value={tf.order} />
          <MonoStat label="Type" value={tf.systemType} />
          <MonoStat label="Poles" value={tf.poles.length} />
          <MonoStat label="Zeros" value={tf.zeros.length} />
        </>
      )}
      {meta.stability && (
        <MonoStat
          label="Stability"
          value={
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
                meta.stability.stable
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              )}
            >
              {meta.stability.stable ? 'stable' : 'unstable'}
            </span>
          }
          mono={false}
        />
      )}
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */

function TfSection({ meta }: { meta: ControlMeta }) {
  const tf = meta.tf!;
  return (
    <PanelSection title="Transfer function" accent={CONTROL_ACCENT} collapsible>
      <div className="rounded-md border border-border-subtle bg-ink/[0.02] px-3 py-2 font-mono text-[12px] leading-relaxed text-text-primary">
        G(s) = {tf.display}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <RootList label="Poles" items={tf.poles} />
        {tf.zeros.length > 0 && <RootList label="Zeros" items={tf.zeros} />}
      </div>
    </PanelSection>
  );
}

function RootList({
  label,
  items,
}: {
  label: string;
  items: { re: number; im: number }[];
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <ul className="space-y-0.5 font-mono text-[11.5px] tabular-nums text-text-primary">
        {items.map((c, i) => (
          <li key={i}>{formatComplex(c)}</li>
        ))}
        {items.length === 0 && (
          <li className="text-text-muted">none</li>
        )}
      </ul>
    </div>
  );
}

function formatComplex(c: { re: number; im: number }): string {
  const r = fmt(c.re);
  if (Math.abs(c.im) < 1e-9) return r;
  if (Math.abs(c.re) < 1e-9) return `${fmt(c.im)}j`;
  const sign = c.im >= 0 ? '+' : '-';
  return `${r} ${sign} ${fmt(Math.abs(c.im))}j`;
}
function fmt(x: number): string {
  if (Math.abs(x) < 1e-12) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  return Number(x.toPrecision(4)).toString();
}

/* ------------------------------------------------------------------ */

function ReductionSection({
  meta,
  ctx,
}: {
  meta: ControlMeta;
  ctx: import('@/workspace/types').WorkspaceContext;
}) {
  const steps = meta.reduction!;
  return (
    <PanelSection
      title="Reduction"
      accent={CONTROL_ACCENT}
      trailing={
        <span className="font-mono text-[10.5px] tabular-nums text-text-muted">
          {steps.length}
        </span>
      }
    >
      <ol className="space-y-1">
        {steps.map((step, i) => (
          <li
            key={i}
            className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-ink/[0.03] cursor-pointer"
            onClick={() => ctx.setStep(Math.min(ctx.totalSteps, (i + 1) * Math.max(1, Math.floor(ctx.totalSteps / steps.length))))}
            title="Scrub canvas to this step"
          >
            <span className="mt-[2px] font-mono text-[10.5px] tabular-nums text-text-muted">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[12px] leading-relaxed text-text-primary">
              {step.description}
            </span>
          </li>
        ))}
      </ol>
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */

function StabilitySection({ meta }: { meta: ControlMeta }) {
  const s = meta.stability;
  return (
    <PanelSection title="Stability" accent={CONTROL_ACCENT}>
      {s && (
        <div className="space-y-0">
          {s.gainMarginDb !== undefined && s.gainMarginDb !== null && (
            <MonoStat
              label="Gain margin"
              value={`${formatFinite(s.gainMarginDb)} dB`}
            />
          )}
          {s.phaseMarginDeg !== undefined && s.phaseMarginDeg !== null && (
            <MonoStat
              label="Phase margin"
              value={`${formatFinite(s.phaseMarginDeg)}°`}
            />
          )}
          {s.wcg !== undefined && s.wcg !== null && (
            <MonoStat label="ω cg" value={`${formatFinite(s.wcg)} rad/s`} />
          )}
          {s.wcp !== undefined && s.wcp !== null && (
            <MonoStat label="ω cp" value={`${formatFinite(s.wcp)} rad/s`} />
          )}
          {s.rhpPoles !== undefined && (
            <MonoStat label="RHP poles" value={s.rhpPoles} />
          )}
        </div>
      )}
      {meta.routh && <RouthTable routh={meta.routh} />}
    </PanelSection>
  );
}

function RouthTable({ routh }: { routh: NonNullable<ControlMeta['routh']> }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
        Routh array
      </div>
      <div className="-mx-2 overflow-x-auto">
        <table className="min-w-full text-[11.5px]">
          <thead>
            <tr>
              {routh.headers.map((h, i) => (
                <th
                  key={i}
                  className="border-b border-border-subtle px-2 py-1.5 text-left font-medium uppercase tracking-[0.08em] text-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routh.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      'border-b border-border-subtle/60 px-2 py-1.5 font-mono tabular-nums',
                      c === 0
                        ? 'text-text-secondary'
                        : 'text-text-primary'
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatFinite(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  return Number(x.toPrecision(4)).toString();
}

/* ------------------------------------------------------------------ */

function MasonSection({ meta }: { meta: ControlMeta }) {
  const m = meta.mason!;
  return (
    <PanelSection
      title="Signal flow"
      accent={CONTROL_ACCENT}
      collapsible
      trailing={
        <span className="font-mono text-[10.5px] tabular-nums text-text-muted">
          P:{m.forwardPaths.length} L:{m.loops.length}
        </span>
      }
    >
      {m.forwardPaths.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
            Forward paths
          </div>
          <ul className="space-y-1 font-mono text-[11.5px] tabular-nums">
            {m.forwardPaths.map((p, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="w-7 text-text-muted">{p.label}</span>
                <span className="flex-1 text-text-primary">{p.path}</span>
                <span className="text-text-secondary">{p.gain}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {m.loops.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
            Loops
          </div>
          <ul className="space-y-1 font-mono text-[11.5px] tabular-nums">
            {m.loops.map((l, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="w-7 text-text-muted">{l.label}</span>
                <span className="flex-1 text-text-primary">{l.path}</span>
                <span className="text-text-secondary">{l.gain}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {m.transferFunction && (
        <div className="rounded-md border border-border-subtle bg-ink/[0.02] px-3 py-2 font-mono text-[11.5px] text-text-primary">
          T(s) = {m.transferFunction}
        </div>
      )}
    </PanelSection>
  );
}
