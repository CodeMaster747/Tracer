import { create } from 'zustand';
import type { ChatMessage, Domain, SolvedQuestion } from '@/engines/types';
import { ALL_EXAMPLES } from '@/data/examples';
import { saveQuestion, setSaved } from '@/lib/storage';
import { useAuthStore } from './auth.store';
import { solveAutomataQuestion } from '@/engines/automata';
import { solveControlQuestion } from '@/engines/control';
import { solveGraphicsQuestion } from '@/engines/graphics';

interface DomainChatState {
  messages: ChatMessage[];
  pending: boolean;
}

interface ChatStore {
  byDomain: Record<Domain, DomainChatState>;
  examples: Record<Domain, SolvedQuestion[]>;
  /** In-memory cache of solved questions keyed by id — used so the canvas
   * can open instantly without waiting for a Firestore round-trip. */
  cache: Record<string, SolvedQuestion>;

  ask: (domain: Domain, text: string) => Promise<void>;
  openExample: (id: string) => Promise<SolvedQuestion | null>;
  saveExample: (id: string) => Promise<SolvedQuestion | null>;
  clearChat: (domain: Domain) => void;
  /** Read-only accessor used by other modules (e.g. CanvasPage). */
  getCached: (id: string) => SolvedQuestion | null;
}

const emptyState: DomainChatState = { messages: [], pending: false };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface SolveOutput {
  matched: SolvedQuestion | null;
  refusal?: { reason: string; manualInstructions: string[] };
}

/**
 * Solver dispatch. Routes to the appropriate engine for each domain.
 */
function solve(domain: Domain, question: string): SolveOutput {
  const engineFor = {
    automata: solveAutomataQuestion,
    control: solveControlQuestion,
    graphics: solveGraphicsQuestion,
  } as const;
  const r = engineFor[domain](question);
  if (r.success) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sq: SolvedQuestion = {
      id,
      domain,
      title: derivedTitle(question, r.summary),
      question,
      summary: r.summary,
      paper: r.paper,
      strokes: r.strokes,
      meta: r.meta,
      createdAt: Date.now(),
    };
    return { matched: sq };
  }
  return {
    matched: null,
    refusal: {
      reason: r.refusalReason ?? 'Could not parse this question.',
      manualInstructions: r.manualInstructions ?? manualSteps(domain),
    },
  };
}

function derivedTitle(question: string, summary: string): string {
  // Prefer the first part of the summary as it's terse and descriptive
  const first = summary.split('.')[0];
  if (first.length <= 80) return first;
  return question.slice(0, 70).trim() + (question.length > 70 ? '…' : '');
}

function manualSteps(d: Domain): string[] {
  switch (d) {
    case 'graphics':
      return [
        'Identify the projection plane(s) — HP (horizontal), VP (vertical), and PP (profile) as needed.',
        'Lay out the XY reference line where the planes meet.',
        'For each defining point of the object, plot its top view (on HP) and front view (on VP) using the given distances above HP and in front of VP.',
        'Connect related points with thin construction lines (projectors), then darken final edges.',
        'Add dimensions and labels.',
      ];
    case 'automata':
      return [
        'Identify the alphabet and the language pattern (e.g. divisibility, contains/ends-with substring, length mod k).',
        'Sketch states as circles; mark the start state with an inbound arrow and accepting states with a double circle.',
        'For each input symbol from each state, draw an outgoing arrow to the appropriate next state.',
        'Self-loops should be drawn as small arcs labeled with the input symbol(s).',
      ];
    case 'control':
      return [
        'Express the system as a transfer function G(s) = N(s)/D(s) in standard form.',
        'Find roots: zeros are roots of N(s), poles are roots of D(s).',
        'Plot poles as crosses (X) and zeros as small circles (O) on the complex s-plane.',
        'Label the real axis as σ and the imaginary axis as jω.',
        'Mark scale on each axis.',
      ];
  }
}

export const useChatStore = create<ChatStore>((set, get) => ({
  byDomain: {
    graphics: { ...emptyState, messages: [] },
    automata: { ...emptyState, messages: [] },
    control: { ...emptyState, messages: [] },
  },
  examples: ALL_EXAMPLES,
  cache: {},

  getCached: (id: string) => get().cache[id] ?? null,

  ask: async (domain, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    set((s) => ({
      byDomain: {
        ...s.byDomain,
        [domain]: {
          ...s.byDomain[domain],
          messages: [...s.byDomain[domain].messages, userMsg],
          pending: true,
        },
      },
    }));

    // Yield briefly so the loading indicator can paint before heavy synchronous solving.
    await new Promise((r) => setTimeout(r, 60));

    const result = solve(domain, trimmed);

    let assistantMsg: ChatMessage;
    const uid = useAuthStore.getState().user?.uid;

    if (result.matched) {
      const cloned: SolvedQuestion = {
        ...result.matched,
        id: result.matched.id || newId(),
        createdAt: Date.now(),
        userId: uid,
        isExample: false,
      };
      // Cache locally so the canvas opens instantly. Persist in the background;
      // a slow/missing Firestore must not block the UI.
      set((s) => ({ cache: { ...s.cache, [cloned.id]: cloned } }));
      if (uid) {
        saveQuestion(uid, cloned).catch((err) =>
          console.warn('ask: background persist failed', err)
        );
      }

      assistantMsg = {
        id: newId(),
        role: 'assistant',
        content: cloned.summary,
        solvedQuestionId: cloned.id,
        createdAt: Date.now(),
      };
    } else {
      assistantMsg = {
        id: newId(),
        role: 'assistant',
        content: result.refusal!.reason,
        refusal: result.refusal,
        createdAt: Date.now(),
      };
    }

    set((s) => ({
      byDomain: {
        ...s.byDomain,
        [domain]: {
          ...s.byDomain[domain],
          messages: [...s.byDomain[domain].messages, assistantMsg],
          pending: false,
        },
      },
    }));
  },

  openExample: async (id) => {
    const ex = Object.values(get().examples)
      .flat()
      .find((q) => q.id === id);
    if (!ex) return null;

    const uid = useAuthStore.getState().user?.uid;
    if (!uid) {
      set((s) => ({ cache: { ...s.cache, [ex.id]: ex } }));
      return ex;
    }

    // Make a per-user copy and cache it immediately so the canvas opens
    // without waiting for Firestore. The save fires-and-forgets in the
    // background.
    const cloned: SolvedQuestion = {
      ...ex,
      id: `${ex.id}-${Date.now()}`,
      createdAt: Date.now(),
      userId: uid,
      isExample: false,
    };
    set((s) => ({ cache: { ...s.cache, [cloned.id]: cloned, [ex.id]: ex } }));
    saveQuestion(uid, cloned).catch((err) =>
      console.warn('openExample: background persist failed', err)
    );
    return cloned;
  },

  saveExample: async (id) => {
    const ex = Object.values(get().examples)
      .flat()
      .find((q) => q.id === id);
    if (!ex) return null;

    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return ex;

    const cloned: SolvedQuestion = {
      ...ex,
      id: `${ex.id}-${Date.now()}`,
      createdAt: Date.now(),
      savedAt: Date.now(),
      userId: uid,
      isExample: false,
    };
    set((s) => ({ cache: { ...s.cache, [cloned.id]: cloned } }));
    saveQuestion(uid, cloned).catch((err) =>
      console.warn('saveExample: background persist failed', err)
    );
    return cloned;
  },

  clearChat: (domain) => {
    set((s) => ({
      byDomain: {
        ...s.byDomain,
        [domain]: { messages: [], pending: false },
      },
    }));
  },
}));

export async function toggleSaved(id: string, saved: boolean): Promise<void> {
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) return;
  await setSaved(uid, id, saved);
}
