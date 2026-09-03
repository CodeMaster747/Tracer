import { useEffect, useState } from 'react';
import {
  IconPlay,
  IconPause,
  IconSkipBack,
  IconSkipForward,
} from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

interface Props {
  current: number;
  total: number;
  playing: boolean;
  onSet: (step: number) => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
}

/**
 * Bottom transport for the workspace: prev / play / next, a clickable tick
 * ruler spanning the sheet, and the step read-out. Each tick is one stroke —
 * the ruler doubles as a picture of how much construction is left.
 */
export function StepNavigator({
  current,
  total,
  playing,
  onSet,
  onPrev,
  onPlayPause,
  onNext,
}: Props) {
  const [draft, setDraft] = useState(String(current));

  useEffect(() => {
    setDraft(String(current));
  }, [current]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(current));
      return;
    }
    const clamped = Math.max(0, Math.min(total, n));
    onSet(clamped);
    setDraft(String(clamped));
  };

  const pad = String(total).length;

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-4">
      <div className="flex items-center gap-1.5">
        <NavBtn onClick={onPrev} aria-label="Previous step">
          <IconSkipBack className="h-3.5 w-3.5" />
        </NavBtn>
        <NavBtn primary onClick={onPlayPause} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <IconPause className="h-3.5 w-3.5" />
          ) : (
            <IconPlay className="h-3.5 w-3.5" />
          )}
        </NavBtn>
        <NavBtn onClick={onNext} aria-label="Next step">
          <IconSkipForward className="h-3.5 w-3.5" />
        </NavBtn>
      </div>

      <div className="h-5 w-px shrink-0 bg-border-subtle" />

      {/* Tick ruler — one tick per stroke, click to scrub. */}
      <div className="flex h-8 min-w-0 flex-1 items-center">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = n < current;
          const isCurrent = n === current;
          return (
            <button
              key={n}
              onClick={() => onSet(n)}
              aria-label={`Step ${n}`}
              className="group flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
            >
              <span
                className={cn(
                  'w-[3px] rounded-sm transition-all duration-100 group-hover:!bg-text-primary',
                  isCurrent
                    ? 'h-6 bg-text-primary'
                    : done
                      ? 'h-4 bg-accent-primary'
                      : 'h-2.5 bg-border-default'
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-2.5">
        <span className="u-label">Step</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{ width: `${pad + 1}ch` }}
          className="bg-transparent text-center font-mono text-[13px] tabular-nums text-text-primary focus:outline-none"
        />
        <span className="font-mono text-[11px] tabular-nums text-text-dim">
          / {total}
        </span>
      </div>
    </div>
  );
}

function NavBtn({
  primary,
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150',
        primary
          ? 'bg-accent-primary text-white hover:bg-accent-secondary'
          : 'border border-border-default bg-bg-secondary text-text-secondary hover:border-border-strong hover:text-text-primary'
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
