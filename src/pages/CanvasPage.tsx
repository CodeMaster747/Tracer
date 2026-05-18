import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { getQuestion, saveQuestion } from '@/lib/storage';
import { findExample } from '@/data/examples';
import type { SolvedQuestion } from '@/engines/types';
import {
  BaseCanvasShell,
  ShellLoadingScreen,
  ShellNotFound,
} from '@/workspace/BaseCanvasShell';
import { resolveModule } from '@/workspace/registry';
import { solveAutomataQuestion } from '@/engines/automata';
import { solveControlQuestion } from '@/engines/control';
import { solveGraphicsQuestion } from '@/engines/graphics';

export default function CanvasPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const uid = useAuthStore((s) => s.user?.uid);
  const [question, setQuestion] = useState<SolvedQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setShowLoadingScreen(true);

    const load = async () => {
      // 1. In-memory session cache — instant.
      const cached = useChatStore.getState().getCached(id);
      let found: SolvedQuestion | null = cached;
      // 2. Local examples bundle — also instant.
      if (!found) found = findExample(id);
      // 3. Firestore fallback (timeout-guarded in storage.ts).
      if (!found && uid) {
        const fromCloud = await getQuestion(uid, id);
        if (fromCloud) found = fromCloud;
      }
      if (cancelled) return;
      // Examples and pre-refactor persisted questions are missing the
      // structured `meta` field — re-run the engine to populate it (and to
      // regenerate diagram-only strokes from the new layout).
      if (found && !found.meta) {
        const hydrated = hydrateMeta(found);
        if (hydrated) found = hydrated;
      }
      setQuestion(found);
      setLoading(false);
      setTimeout(() => {
        if (!cancelled) setShowLoadingScreen(false);
      }, 300);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, uid]);

  // Persist mutations from the workspace (e.g. paper change). Fire-and-forget
  // so a slow Firestore can't lock up the UI.
  const handleQuestionUpdate = (next: SolvedQuestion) => {
    setQuestion(next);
    if (uid && !next.isExample) {
      saveQuestion(uid, next).catch((err) =>
        console.warn('question update: persist failed', err)
      );
    }
  };

  if (loading || showLoadingScreen) return <ShellLoadingScreen />;
  if (!question) return <ShellNotFound onBack={() => navigate('/app/history')} />;

  const module = resolveModule(question.domain);

  return (
    <BaseCanvasShell
      key={question.id}
      module={module}
      initialQuestion={question}
      onQuestionUpdate={handleQuestionUpdate}
    />
  );
}

/**
 * Re-solve a question that was loaded without structured meta (typically an
 * example bundle entry or a pre-refactor persisted question). Returns a new
 * SolvedQuestion with fresh strokes (from the diagram-only layout) and the
 * engine's `meta`. Falls back to the input if the engine refuses — the
 * canvas can still render the legacy strokes in that case.
 */
function hydrateMeta(q: SolvedQuestion): SolvedQuestion | null {
  const engineFor = {
    automata: solveAutomataQuestion,
    control: solveControlQuestion,
    graphics: solveGraphicsQuestion,
  } as const;
  const solve = engineFor[q.domain];
  if (!solve) return null;
  try {
    const r = solve(q.question);
    if (!r.success || !r.meta) return null;
    return {
      ...q,
      paper: r.paper,
      strokes: r.strokes,
      meta: r.meta,
      summary: r.summary || q.summary,
    };
  } catch (err) {
    console.warn('hydrateMeta failed', err);
    return null;
  }
}
