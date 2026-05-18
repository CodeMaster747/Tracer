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

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 items-center gap-2 rounded-lg border border-border-subtle bg-white/[0.02] px-2.5">
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-text-muted">
          Step
        </span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-8 bg-transparent text-center font-mono text-xs text-text-primary focus:outline-none"
        />
        <span className="text-[11px] text-text-muted">/ {total}</span>
      </div>

      <div className="flex items-center gap-1">
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
          ? 'bg-text-primary text-bg-primary hover:bg-white'
          : 'border border-border-subtle bg-white/[0.02] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
