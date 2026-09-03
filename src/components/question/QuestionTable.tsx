import type { ReactNode } from 'react';
import type { SolvedQuestion } from '@/engines/types';
import { DOMAIN_META, formatDate } from '@/components/question/domainMeta';

interface Props {
  items: SolvedQuestion[];
  onOpen: (q: SolvedQuestion) => void;
  actions: (q: SolvedQuestion) => ReactNode;
  dateLabel: string;
}

/**
 * Hairline-ruled index of questions. Deliberately a table rather than a stack
 * of cards — the columns let you scan module, length and date down the page.
 */
export function QuestionTable({ items, onOpen, actions, dateLabel }: Props) {
  return (
    <div>
      <div className="flex items-center gap-4 border-b border-border-strong px-3.5 pb-2.5">
        <div className="w-4 shrink-0" />
        <div className="u-label flex-1">Question</div>
        <div className="u-label w-[104px] shrink-0">Module</div>
        <div className="u-label w-[68px] shrink-0 text-right">Steps</div>
        <div className="u-label w-[96px] shrink-0 text-right">{dateLabel}</div>
        <div className="w-[150px] shrink-0" />
      </div>

      {items.map((q) => (
        <Row key={q.id} q={q} onOpen={() => onOpen(q)} actions={actions(q)} />
      ))}

      <div className="flex items-center px-3.5 py-4">
        <span className="font-mono text-[11.5px] tabular-nums text-text-muted">
          {items.length === 1 ? '1 question' : `${items.length} questions`}
        </span>
      </div>
    </div>
  );
}

function Row({
  q,
  onOpen,
  actions,
}: {
  q: SolvedQuestion;
  onOpen: () => void;
  actions: ReactNode;
}) {
  const { label, Icon, tone } = DOMAIN_META[q.domain];
  return (
    <div
      onClick={onOpen}
      className="group flex h-[62px] cursor-pointer items-center gap-4 border-b border-border-subtle px-3.5 transition-colors duration-150 hover:bg-ink/[0.02]"
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: tone }} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-text-primary">
          {q.title}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
          {q.paper.widthMm} × {q.paper.heightMm} mm
          {q.savedAt ? ' · saved' : ''}
        </div>
      </div>

      <div className="w-[104px] shrink-0 text-[12.5px] text-text-secondary">
        {label}
      </div>
      <div className="w-[68px] shrink-0 text-right font-mono text-[12.5px] tabular-nums text-text-primary">
        {q.strokes.length}
      </div>
      <div className="w-[96px] shrink-0 text-right font-mono text-[12px] tabular-nums text-text-muted">
        {formatDate(q.savedAt ?? q.createdAt)}
      </div>

      <div
        className="flex w-[150px] shrink-0 justify-end gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {actions}
      </div>
    </div>
  );
}
