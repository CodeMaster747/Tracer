import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PanelSectionProps {
  title: string;
  /** Optional small text/badge rendered on the right side of the header. */
  trailing?: ReactNode;
  /** When provided, header becomes a button toggling open/close. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Optional accent color for a 1px left border (subject-specific). */
  accent?: string;
  children: ReactNode;
}

export function PanelSection({
  title,
  trailing,
  collapsible = false,
  defaultOpen = true,
  accent,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  return (
    <section
      className={cn(
        'border-b border-border-subtle',
        accent && 'border-l',
        accent && 'border-l-transparent' // base; inline style overrides
      )}
      style={accent ? { borderLeftColor: accent + '33' } : undefined}
    >
      <header
        className={cn(
          'flex items-center justify-between px-5 py-3',
          collapsible &&
            'cursor-pointer select-none hover:bg-ink/[0.02] transition-colors duration-150'
        )}
        onClick={() => collapsible && setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <Caret open={isOpen} />
          )}
          <span className="u-label">
            {title}
          </span>
        </div>
        {trailing}
      </header>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      className={cn(
        'text-text-muted transition-transform duration-150',
        open ? 'rotate-90' : ''
      )}
    >
      <path
        d="m4 3 4 3-4 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface MonoStatProps {
  label: string;
  value: ReactNode;
  /** Render value in tabular-nums monospace. Default true. */
  mono?: boolean;
}

export function MonoStat({ label, value, mono = true }: MonoStatProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span
        className={cn(
          'text-[12.5px] text-text-primary',
          mono && 'font-mono tabular-nums'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-8 text-center text-xs text-text-muted">
      {children}
    </div>
  );
}

/**
 * Compact title + summary header shown at the top of the sidebar. Replaces
 * the doc-title / doc-summary that used to be drawn on the paper canvas.
 */
export function Headline({
  title,
  summary,
  accent,
}: {
  title?: string;
  summary?: string;
  accent?: string;
}) {
  if (!title && !summary) return null;
  return (
    <section
      className="border-b border-border-subtle px-5 py-4"
      style={accent ? { borderLeft: `1px solid ${accent}33` } : undefined}
    >
      {title && (
        <h2 className="text-[13px] font-semibold leading-snug text-text-primary">
          {title}
        </h2>
      )}
      {summary && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-secondary">
          {summary}
        </p>
      )}
    </section>
  );
}
