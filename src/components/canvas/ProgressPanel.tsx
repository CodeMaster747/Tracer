interface Props {
  current: number;
  total: number;
}

export function ProgressPanel({ current, total }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <aside className="w-[220px] shrink-0 border-l border-border-subtle bg-bg-secondary px-5 py-5">
      <div className="flex items-center justify-between">
        <span className="u-label">
          Progress
        </span>
        <span className="font-mono text-xs tabular-nums text-text-primary">
          {current} / {total}
        </span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/[0.04]">
        <div
          className="h-full bg-text-primary transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-text-muted">{pct}% complete</div>
    </aside>
  );
}
