import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { AutomataMeta, AutomataSimStep } from '@/engines/types';
import { Headline, MonoStat, PanelSection } from '@/workspace/PanelSection';
import { ContentBlocks } from '@/workspace/ContentBlocks';
import { cn } from '@/lib/utils';
import type { ModuleSlotProps } from '@/workspace/types';
import { AUTOMATA_ACCENT } from './accent';

export function AutomataSidebar({ ctx }: ModuleSlotProps) {
  const meta = ctx.question.meta?.kind === 'automata' ? ctx.question.meta : null;

  // Fallback for the rare case meta is genuinely unavailable (engine refusal
  // path). The question summary still gives the user something readable.
  if (!meta) {
    return (
      <div>
        <Headline
          title={ctx.question.title}
          summary={ctx.question.summary}
          accent={AUTOMATA_ACCENT}
        />
      </div>
    );
  }

  return (
    <div>
      <Headline
        title={meta.headline?.title || ctx.question.title}
        summary={meta.headline?.summary || ctx.question.summary}
        accent={AUTOMATA_ACCENT}
      />
      <MachineInfoSection meta={meta} />
      {meta.table && <TransitionTableSection meta={meta} />}
      {meta.simulation && <SimulationSection meta={meta} />}
      {meta.outputs && meta.outputs.length > 0 && (
        <OutputsSection meta={meta} />
      )}
      {meta.content && meta.content.length > 0 && (
        <ContentBlocks blocks={meta.content} accent={AUTOMATA_ACCENT} />
      )}
      <PanelSection title="Conversions" accent={AUTOMATA_ACCENT}>
        <ConversionHints meta={meta} />
      </PanelSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MachineInfoSection({ meta }: { meta: AutomataMeta }) {
  return (
    <PanelSection title="Machine" accent={AUTOMATA_ACCENT}>
      <MonoStat label="Type" value={meta.type} mono={false} />
      <MonoStat label="States |Q|" value={meta.states.length} />
      <MonoStat
        label="Alphabet Σ"
        value={meta.alphabet.length ? `{${meta.alphabet.join(', ')}}` : '∅'}
      />
      <MonoStat label="Start q₀" value={meta.start || '—'} />
      <MonoStat
        label="Accept F"
        value={
          meta.accepting.length
            ? `{${meta.accepting.join(', ')}}`
            : '∅'
        }
      />
      <MonoStat label="Transitions" value={meta.transitions.length} />
      {meta.hasStack && (
        <MonoStat label="Stack" value="enabled" mono={false} />
      )}
      {meta.hasTape && <MonoStat label="Tape" value="enabled" mono={false} />}
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */

function TransitionTableSection({ meta }: { meta: AutomataMeta }) {
  const table = meta.table!;
  return (
    <PanelSection
      title="Transition table"
      accent={AUTOMATA_ACCENT}
      collapsible
      trailing={
        <span className="font-mono text-[10.5px] tabular-nums text-text-muted">
          {table.rows.length}×{table.headers.length - 1}
        </span>
      }
    >
      <div className="-mx-2 overflow-x-auto">
        <table className="min-w-full text-[11.5px]">
          <thead>
            <tr>
              {table.headers.map((h, i) => (
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
            {table.rows.map((row, r) => (
              <tr key={r} className="hover:bg-ink/[0.02]">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      'border-b border-border-subtle/60 px-2 py-1.5 font-mono tabular-nums text-text-primary',
                      c === 0 && 'text-text-secondary'
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
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */

function SimulationSection({ meta }: { meta: AutomataMeta }) {
  const sim = meta.simulation!;
  const verdictColor = sim.accepted
    ? 'text-emerald-400'
    : 'text-rose-400';

  return (
    <PanelSection
      title="Simulation"
      accent={AUTOMATA_ACCENT}
      trailing={
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
            sim.accepted
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          )}
        >
          {sim.accepted ? 'accepted' : 'rejected'}
        </span>
      }
    >
      <div className="mb-3 rounded-md border border-border-subtle bg-ink/[0.02] px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
          Input
        </div>
        <div className="mt-1 break-all font-mono text-xs text-text-primary">
          {sim.input || 'ε'}
        </div>
      </div>

      <TraceList steps={sim.steps} accepted={sim.accepted} />

      {sim.reason && (
        <div className={cn('mt-3 text-[11px] leading-relaxed', verdictColor)}>
          {sim.reason}
        </div>
      )}
    </PanelSection>
  );
}

function TraceList({
  steps,
  accepted,
}: {
  steps: AutomataSimStep[];
  accepted: boolean;
}) {
  if (steps.length === 0) {
    return (
      <div className="text-[11px] text-text-muted">No trace recorded.</div>
    );
  }
  return (
    <ol className="space-y-1">
      {steps.map((step, i) => (
        <motion.li
          key={step.index}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.14, delay: Math.min(i * 0.015, 0.2) }}
          className="flex items-center gap-2 font-mono text-[11.5px] tabular-nums"
        >
          <span className="w-5 text-right text-text-muted">{step.index}</span>
          <span className="text-text-secondary">
            {renderActive(step)}
          </span>
          {step.symbol !== undefined && step.symbol !== '' && (
            <>
              <span className="text-text-muted">─{step.symbol}→</span>
            </>
          )}
          {(step.consumed || step.remaining) && (
            <span className="ml-auto text-[10.5px] text-text-muted">
              {step.consumed || 'ε'}|{step.remaining || 'ε'}
            </span>
          )}
        </motion.li>
      ))}
      <li className="pt-1 text-[10.5px] uppercase tracking-[0.1em] text-text-muted">
        {accepted ? '✓ halted in accepting state' : '✗ halted'}
      </li>
    </ol>
  );
}

function renderActive(s: AutomataSimStep): string {
  if (s.state !== undefined) return s.state;
  if (s.states && s.states.length > 0) return `{${s.states.join(',')}}`;
  return '∅';
}

/* ------------------------------------------------------------------ */

function OutputsSection({ meta }: { meta: AutomataMeta }) {
  const outputs = meta.outputs!;
  const mode = meta.type === 'Mealy' ? 'Mealy edge outputs' : 'Moore state outputs';
  return (
    <PanelSection title={mode} accent={AUTOMATA_ACCENT} collapsible>
      <div className="space-y-1">
        {outputs.map((o) => (
          <div
            key={o.key}
            className="flex items-baseline justify-between gap-3 font-mono text-[11.5px]"
          >
            <span className="text-text-secondary">{o.key}</span>
            <span className="text-text-primary">{o.value}</span>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */

function ConversionHints({ meta }: { meta: AutomataMeta }) {
  const hints = useMemo(() => {
    const out: { label: string; example: string }[] = [];
    if (meta.type === 'NFA' || meta.type === 'ε-NFA') {
      out.push({
        label: 'Subset construction → DFA',
        example: 'convert this NFA to a DFA',
      });
    }
    if (meta.type === 'DFA') {
      out.push({
        label: 'Minimize DFA',
        example: 'minimize this DFA',
      });
      out.push({
        label: 'Equivalent regex',
        example: 'convert this DFA to a regex',
      });
    }
    if (meta.type === 'Mealy') {
      out.push({
        label: 'Mealy → Moore',
        example: 'convert mealy to moore',
      });
    }
    if (meta.type === 'Moore') {
      out.push({
        label: 'Moore → Mealy',
        example: 'convert moore to mealy',
      });
    }
    return out;
  }, [meta.type]);

  if (hints.length === 0) {
    return (
      <div className="text-[11px] text-text-muted leading-relaxed">
        No automatic conversions available for {meta.type}.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {hints.map((h) => (
        <ConversionRow key={h.label} label={h.label} example={h.example} />
      ))}
    </div>
  );
}

function ConversionRow({ label, example }: { label: string; example: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      className="group flex w-full items-center justify-between rounded-md border border-border-subtle bg-ink/[0.02] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-ink/[0.04]"
      title={`Copy "${example}" to clipboard`}
    >
      <span className="text-[12px] text-text-primary">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted group-hover:text-text-secondary">
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
  );
}
