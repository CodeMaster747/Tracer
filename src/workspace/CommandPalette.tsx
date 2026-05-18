import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Command, WorkspaceContext } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  ctx: WorkspaceContext;
  commands: Command[];
}

/**
 * Fuzzy-search modal listing every command exposed by the current
 * workspace. Triggered by ⌘K / Ctrl-K. Up/Down to navigate, Enter to run,
 * Escape to close.
 */
export function CommandPalette({ open, onClose, ctx, commands }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      // Defer focus so the input exists in the DOM.
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const results = useMemo(() => {
    const all = commands.map((c) => ({
      cmd: c,
      score: matchScore(query, c.label + ' ' + (c.hint ?? '') + ' ' + c.group),
    }));
    const filtered = query.trim()
      ? all.filter((r) => r.score > 0)
      : all.map((r) => ({ ...r, score: 1 }));
    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, 60).map((r) => r.cmd);
  }, [commands, query]);

  const grouped = useMemo(() => {
    const out: { group: string; items: Command[] }[] = [];
    const byGroup = new Map<string, Command[]>();
    for (const c of results) {
      const arr = byGroup.get(c.group) ?? [];
      arr.push(c);
      byGroup.set(c.group, arr);
    }
    for (const [group, items] of byGroup) {
      out.push({ group, items });
    }
    return out;
  }, [results]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = results[selected];
        if (cmd) {
          void runCommand(cmd, ctx, onClose);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selected, ctx, onClose]);

  // Keep selection in view as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-idx="${selected}"]`
    );
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[14vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.14, ease: [0.25, 1, 0.5, 1] }}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border-default bg-bg-elevated shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                className="text-text-muted"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="m10 10 3 3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                placeholder="Run a command…"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="rounded border border-border-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                Esc
              </kbd>
            </div>

            <div
              ref={listRef}
              className="max-h-[50vh] overflow-y-auto"
            >
              {grouped.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-text-muted">
                  No matching commands.
                </div>
              ) : (
                grouped.map((g) => (
                  <div key={g.group}>
                    <div className="border-b border-border-subtle/60 bg-bg-secondary/40 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
                      {g.group}
                    </div>
                    {g.items.map((cmd) => {
                      const idx = results.indexOf(cmd);
                      const active = idx === selected;
                      return (
                        <button
                          key={cmd.id}
                          data-cmd-idx={idx}
                          onMouseEnter={() => setSelected(idx)}
                          onClick={() => runCommand(cmd, ctx, onClose)}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors duration-100',
                            active
                              ? 'bg-white/[0.06]'
                              : 'hover:bg-white/[0.03]'
                          )}
                        >
                          <CommandGlyph icon={cmd.icon} />
                          <span className="flex-1 truncate text-text-primary">
                            {cmd.label}
                          </span>
                          {cmd.hint && (
                            <span className="truncate font-mono text-[10.5px] tabular-nums text-text-muted">
                              {cmd.hint}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-[10px] text-text-muted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border-subtle px-1 font-mono">
                    ↑
                  </kbd>
                  <kbd className="rounded border border-border-subtle px-1 font-mono">
                    ↓
                  </kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border-subtle px-1 font-mono">
                    ↵
                  </kbd>
                  to run
                </span>
              </div>
              <span className="font-mono">{results.length} result{results.length === 1 ? '' : 's'}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandGlyph({ icon }: { icon?: Command['icon'] }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0 text-text-muted';
  switch (icon) {
    case 'step':
      return (
        <svg viewBox="0 0 14 14" className={cls}>
          <path
            d="M3 3 H11 M3 7 H11 M3 11 H8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'plot':
      return (
        <svg viewBox="0 0 14 14" className={cls}>
          <path
            d="M2 11 L5 7 L8 9 L12 3"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'convert':
      return (
        <svg viewBox="0 0 14 14" className={cls}>
          <path
            d="M3 5 H10 M8 3 L10 5 L8 7 M11 9 H4 M6 7 L4 9 L6 11"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'view':
      return (
        <svg viewBox="0 0 14 14" className={cls}>
          <path
            d="M1.5 7 C 4 3, 10 3, 12.5 7 C 10 11, 4 11, 1.5 7Z"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <circle cx="7" cy="7" r="1.6" fill="currentColor" />
        </svg>
      );
    case 'export':
      return (
        <svg viewBox="0 0 14 14" className={cls}>
          <path
            d="M7 2 V9 M4 6 L7 9 L10 6 M3 12 H11"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'doc':
    default:
      return (
        <svg viewBox="0 0 14 14" className={cls}>
          <path
            d="M4 2 H9 L11 4 V12 H4 Z"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path d="M6 6 H9 M6 8 H9 M6 10 H8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
  }
}

async function runCommand(cmd: Command, ctx: WorkspaceContext, onClose: () => void) {
  onClose();
  try {
    await cmd.action(ctx);
  } catch (err) {
    console.warn('Command failed:', cmd.id, err);
  }
}

/* ------------------------------------------------------------------ */
/* Tiny fuzzy match — token-substring with proximity bonus.            */
/* ------------------------------------------------------------------ */

function matchScore(query: string, haystack: string): number {
  const q = query.trim().toLowerCase();
  const h = haystack.toLowerCase();
  if (!q) return 0;
  if (h.includes(q)) return 1000 + (h.startsWith(q) ? 100 : 0);
  // token-by-token substring
  const tokens = q.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const tok of tokens) {
    const idx = h.indexOf(tok);
    if (idx < 0) return 0;
    score += 50 - Math.min(40, idx);
  }
  return score;
}
