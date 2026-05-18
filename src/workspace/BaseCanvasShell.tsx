import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { SolvedQuestion } from '@/engines/types';
import { exportSvgAsPng, exportSvgAsPdf, safeFilename } from '@/lib/export';
import { Button } from '@/components/ui/Button';
import {
  IconArrowLeft,
  IconEye,
  IconQuestion,
} from '@/components/ui/Icon';
import { StepNavigator } from '@/components/canvas/StepNavigator';
import { ExportMenu } from '@/components/canvas/ExportMenu';
import { QuestionModal } from '@/components/canvas/QuestionModal';
import { cn } from '@/lib/utils';
import { BaseCanvasViewport } from './BaseCanvasViewport';
import { usePlaybackClock } from './usePlaybackClock';
import { CommandPalette } from './CommandPalette';
import { buildCommonCommands } from './commonCommands';
import type { Command, Selection, WorkspaceContext, WorkspaceModule } from './types';

interface Props {
  module: WorkspaceModule;
  initialQuestion: SolvedQuestion;
  onQuestionUpdate: (next: SolvedQuestion) => void;
}

/**
 * Shared chrome for every workspace. Holds the question, playback clock,
 * selection state, top bar, side frames, and viewport. Subject specifics
 * (panels, canvas content, toolbar slots) come from the module.
 */
export function BaseCanvasShell({
  module,
  initialQuestion,
  onQuestionUpdate,
}: Props) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState<SolvedQuestion>(initialQuestion);
  const [hovered, setHovered] = useState<Selection>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const totalSteps = module.getTotalSteps(question);
  const viewport = module.getViewport(question);
  const metaLine = module.getMetaLine?.(question) ?? '';

  const playback = usePlaybackClock({ total: totalSteps });

  const updateQuestion = (next: SolvedQuestion) => {
    setQuestion(next);
    onQuestionUpdate(next);
  };

  const ctx: WorkspaceContext = useMemo(
    () => ({
      question,
      updateQuestion,
      currentStep: playback.currentStep,
      totalSteps,
      setStep: playback.setStep,
      hovered,
      setHovered,
      selection,
      setSelection,
    }),
    // updateQuestion is stable enough; playback methods are recreated each render
    // but only the values that drive rerenders matter for slot props.
    [question, playback.currentStep, totalSteps, hovered, selection, playback.setStep]
  );

  const commands: Command[] = useMemo(() => {
    const common = buildCommonCommands(ctx);
    const moduleCmds = module.getCommands?.(ctx) ?? [];
    return [...common, ...moduleCmds];
  }, [ctx, module]);

  // Cmd/Ctrl+K opens the palette. Skip when the user is typing into an input
  // (so the step-number input still works normally).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExportPng = async () => {
    if (!svgRef.current) return;
    const name = safeFilename(
      (module.getExportName?.(question) ?? question.title) || 'tracer-export'
    );
    await exportSvgAsPng(svgRef.current, name, question.paper);
  };

  const handleExportPdf = async () => {
    if (!svgRef.current) return;
    const name = safeFilename(
      (module.getExportName?.(question) ?? question.title) || 'tracer-export'
    );
    await exportSvgAsPdf(svgRef.current, name, question.paper);
  };

  const { LeftSidebar, RightInspector, ToolbarSlots, CanvasContent } = module;

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className="z-20 flex h-14 items-center gap-3 border-b border-border-subtle bg-bg-secondary px-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-text-primary"
          aria-label="Back"
        >
          <IconArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-text-primary">
            {question.title}
          </h1>
          <div className="text-[10.5px] text-text-muted">
            <span className="uppercase tracking-[0.08em]">
              {module.displayName}
            </span>
            {metaLine && (
              <>
                <span className="mx-1.5 text-text-dim">·</span>
                <span>{metaLine}</span>
              </>
            )}
          </div>
        </div>

        {ToolbarSlots && (
          <div className="ml-2 flex items-center gap-2">
            <ToolbarSlots ctx={ctx} />
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden h-9 items-center gap-2 rounded-lg border border-border-subtle bg-white/[0.02] px-3 text-[12px] text-text-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-text-primary md:inline-flex"
          aria-label="Open command palette"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            className="text-text-muted"
          >
            <circle
              cx="6"
              cy="6"
              r="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="m8.5 8.5 3 3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <span>Search</span>
          <kbd className="rounded border border-border-subtle px-1 font-mono text-[10px] tabular-nums text-text-muted">
            ⌘K
          </kbd>
        </button>

        <StepNavigator
          current={playback.currentStep}
          total={totalSteps}
          playing={playback.playing}
          onSet={playback.setStep}
          onPrev={playback.prev}
          onPlayPause={playback.playPause}
          onNext={playback.next}
        />

        <button
          onClick={playback.drawAndShow}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium transition-colors duration-150',
            playback.drawAndShowMode
              ? 'bg-white/[0.08] text-text-primary border border-border-default'
              : 'bg-text-primary text-bg-primary hover:bg-white'
          )}
        >
          <IconEye className="h-3.5 w-3.5" />
          {playback.drawAndShowMode ? 'Showing…' : 'Draw & Show'}
        </button>

        <Button
          variant="secondary"
          size="md"
          onClick={() => setQuestionOpen(true)}
          leftIcon={<IconQuestion className="h-3.5 w-3.5" />}
        >
          Question
        </Button>

        <ExportMenu onExportPng={handleExportPng} onExportPdf={handleExportPdf} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[280px] shrink-0 border-r border-border-subtle bg-bg-secondary overflow-y-auto">
          <LeftSidebar ctx={ctx} />
        </aside>

        <div className="flex-1 overflow-hidden">
          <BaseCanvasViewport ref={svgRef} viewport={viewport}>
            <CanvasContent ctx={ctx} />
          </BaseCanvasViewport>
        </div>

        <aside className="w-[220px] shrink-0 border-l border-border-subtle bg-bg-secondary overflow-y-auto">
          <RightInspector ctx={ctx} />
        </aside>
      </div>

      <QuestionModal
        open={questionOpen}
        question={question.question}
        summary={question.summary}
        onClose={() => setQuestionOpen(false)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        ctx={ctx}
        commands={commands}
      />
    </div>
  );
}

export function ShellLoadingScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-bg-primary">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-text-secondary"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="text-xs text-text-muted">Loading canvas…</div>
      </motion.div>
    </div>
  );
}

export function ShellNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-bg-primary">
      <div className="rounded-xl border border-border-subtle bg-bg-secondary px-8 py-7 text-center">
        <div className="text-sm font-semibold text-text-primary">
          Question not found
        </div>
        <div className="mt-1 text-sm text-text-secondary">
          It may have been deleted or never saved.
        </div>
        <Button
          className="mt-5"
          variant="secondary"
          onClick={onBack}
          leftIcon={<IconArrowLeft className="h-3.5 w-3.5" />}
        >
          Back to History
        </Button>
      </div>
    </div>
  );
}
