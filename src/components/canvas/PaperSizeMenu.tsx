import { useEffect, useRef, useState } from 'react';
import type { PaperOrientation, PaperSize, PaperSpec } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { cn } from '@/lib/utils';

interface Props {
  paper: PaperSpec;
  onChange: (paper: PaperSpec) => void;
}

const SIZES: PaperSize[] = ['A4', 'A3', 'A2'];
const ORIENTATIONS: PaperOrientation[] = ['portrait', 'landscape'];

export function PaperSizeMenu({ paper, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border-subtle bg-white/[0.02] px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary transition-colors duration-150 hover:border-border-default hover:text-text-primary"
      >
        {paper.size} {paper.orientation}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          className="text-text-muted"
        >
          <path
            d="m3 4.5 3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[220px] overflow-hidden rounded-lg border border-border-default bg-bg-elevated">
          <div className="p-2">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Paper size
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    onChange(paperSpec(s, paper.orientation))
                  }
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150',
                    s === paper.size
                      ? 'bg-white/[0.08] text-text-primary'
                      : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border-subtle p-2">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Orientation
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => onChange(paperSpec(paper.size, o))}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors duration-150',
                    o === paper.orientation
                      ? 'bg-white/[0.08] text-text-primary'
                      : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
