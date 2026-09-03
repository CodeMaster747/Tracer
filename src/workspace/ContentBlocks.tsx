import type { WorkspaceContentBlock } from '@/engines/types';
import { PanelSection } from './PanelSection';
import { cn } from '@/lib/utils';

/**
 * Render the engine's prose/equations/matrices/tables/lists in the sidebar.
 * Each block becomes its own collapsible PanelSection so a long solution
 * stays scannable.
 */
export function ContentBlocks({
  blocks,
  accent,
}: {
  blocks: WorkspaceContentBlock[];
  accent?: string;
}) {
  return (
    <>
      {blocks.map((block, i) => (
        <PanelSection
          key={i}
          title={block.title || defaultTitle(block)}
          accent={accent}
          collapsible
        >
          <BlockBody block={block} />
        </PanelSection>
      ))}
    </>
  );
}

function defaultTitle(b: WorkspaceContentBlock): string {
  switch (b.kind) {
    case 'text':
      return 'Notes';
    case 'list':
      return 'Steps';
    case 'equation':
      return 'Equation';
    case 'matrix':
      return b.name || 'Matrix';
    case 'table':
      return 'Table';
  }
}

function BlockBody({ block }: { block: WorkspaceContentBlock }) {
  switch (block.kind) {
    case 'text':
      return (
        <div
          className={cn(
            'space-y-1.5 text-[12px] leading-relaxed text-text-primary',
            block.mono && 'font-mono tabular-nums'
          )}
        >
          {block.lines.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      );

    case 'list':
      return (
        <ListBody items={block.items} ordered={block.ordered ?? true} />
      );

    case 'equation':
      return (
        <div className="space-y-2">
          {block.lines.map((line, i) => (
            <div
              key={i}
              className="overflow-x-auto rounded-md border border-border-subtle bg-ink/[0.02] px-3 py-2 font-mono text-[12px] leading-relaxed text-text-primary"
            >
              {line}
            </div>
          ))}
        </div>
      );

    case 'matrix':
      return <MatrixBody name={block.name} data={block.data} />;

    case 'table':
      return <TableBody headers={block.headers} rows={block.rows} />;
  }
}

/* ------------------------------------------------------------------ */

function ListBody({
  items,
  ordered,
}: {
  items: string[];
  ordered: boolean;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className="space-y-1.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 text-[12px] leading-relaxed text-text-primary"
        >
          <span className="mt-[2px] w-4 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-text-muted">
            {ordered ? String(i + 1) : '·'}
          </span>
          <span className="flex-1 whitespace-pre-wrap">{item}</span>
        </li>
      ))}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */

function TableBody({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="min-w-full text-[11.5px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
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
          {rows.map((row, r) => (
            <tr key={r} className="hover:bg-ink/[0.02]">
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
  );
}

/* ------------------------------------------------------------------ */

function MatrixBody({ name, data }: { name: string; data: number[][] }) {
  return (
    <div className="space-y-1.5">
      <div className="u-label">
        {name}
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="ml-1 font-mono text-[11.5px] tabular-nums">
          <tbody>
            {data.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="px-2 py-1 text-text-primary"
                  >
                    {format(cell)}
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

function format(x: number): string {
  if (Math.abs(x) < 1e-12) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  return Number(x.toPrecision(4)).toString();
}
