import type {
  AutomataMachineType,
  AutomataMeta,
  AutomataSimStep,
  AutomataTransition,
  WorkspaceContentBlock,
} from '@/engines/types';
import type { AutomatonView, DocSection, SolutionDoc } from './types';

/** Section kinds whose content stays on the paper canvas. Everything else
 * flows to the sidebar via `content` / structured meta fields. */
const DIAGRAM_KINDS = new Set<DocSection['kind']>([
  'automaton',
  'parse-tree',
  'tm-tape',
]);

export function isAutomataDiagramSection(s: DocSection): boolean {
  return DIAGRAM_KINDS.has(s.kind);
}

/**
 * Extract a JSON-safe AutomataMeta from a SolutionDoc.
 *
 * The doc model uses Sets and Maps (not JSON-friendly) and lives only in
 * memory. The meta is what gets attached to the SolvedQuestion so the
 * Automata workspace can render its sidebar regardless of how the question
 * was loaded (chat solve, examples bundle, or Firestore round-trip).
 */
export function automataMetaFromDoc(doc: SolutionDoc): AutomataMeta | null {
  const primary = doc.sections.find(
    (s): s is Extract<DocSection, { kind: 'automaton' }> => s.kind === 'automaton'
  );
  if (!primary) return null;
  const v = primary.view;

  const type = inferMachineType(v);
  const transitions = flattenDelta(v);

  const consumed = new Set<DocSection>();
  const table = findTransitionTable(doc.sections, consumed);
  const simulation = findSimulationTrace(doc.sections, type === 'DFA', consumed);

  const outputs = v.outputs
    ? [...v.outputs.entries()].map(([key, value]) => ({ key, value }))
    : undefined;

  const content = collectContent(doc.sections, consumed);

  return {
    kind: 'automata',
    type,
    alphabet: [...v.alphabet],
    states: [...v.states],
    start: v.start,
    accepting: [...v.accepting],
    transitions,
    table,
    simulation,
    hasStack: /pda|pushdown/i.test(v.title),
    hasTape: /turing|\btm\b/i.test(v.title),
    outputs,
    headline: { title: doc.title, summary: doc.summary },
    content: content.length ? content : undefined,
  };
}

function collectContent(
  sections: DocSection[],
  consumed: Set<DocSection>
): WorkspaceContentBlock[] {
  const out: WorkspaceContentBlock[] = [];
  for (const sec of sections) {
    if (consumed.has(sec)) continue;
    if (isAutomataDiagramSection(sec)) continue;
    switch (sec.kind) {
      case 'text-block':
        out.push({
          kind: 'text',
          title: sec.title,
          lines: sec.lines,
          mono: sec.mono,
        });
        break;
      case 'table':
        out.push({
          kind: 'table',
          title: sec.title,
          headers: sec.headers,
          rows: sec.rows,
        });
        break;
      case 'derivation':
        out.push({
          kind: 'list',
          title: sec.title ?? 'Derivation',
          ordered: true,
          items: sec.steps,
        });
        break;
    }
  }
  return out;
}

function inferMachineType(v: AutomatonView): AutomataMachineType {
  if (v.outputMode === 'mealy') return 'Mealy';
  if (v.outputMode === 'moore') return 'Moore';
  if (/pda|pushdown/i.test(v.title)) return 'PDA';
  if (/turing|\btm\b/i.test(v.title)) return 'TM';
  // Detect ε-NFA / NFA: epsilon symbol present, or any (state, symbol) maps to multiple targets.
  let hasEpsilon = false;
  let nondeterministic = false;
  for (const [, row] of v.delta) {
    for (const [sym, dst] of row) {
      if (sym === '' || sym === 'ε') hasEpsilon = true;
      if (dst.size > 1) nondeterministic = true;
    }
  }
  if (hasEpsilon) return 'ε-NFA';
  if (nondeterministic) return 'NFA';
  return 'DFA';
}

function flattenDelta(v: AutomatonView): AutomataTransition[] {
  const out: AutomataTransition[] = [];
  for (const [from, row] of v.delta) {
    for (const [sym, dsts] of row) {
      for (const to of dsts) {
        out.push({ from, symbol: sym === '' ? 'ε' : sym, to });
      }
    }
  }
  // Stable order: by from, then symbol, then to.
  out.sort((a, b) =>
    a.from.localeCompare(b.from) ||
    a.symbol.localeCompare(b.symbol) ||
    a.to.localeCompare(b.to)
  );
  return out;
}

function findTransitionTable(
  sections: DocSection[],
  consumed: Set<DocSection>
): { headers: string[]; rows: string[][] } | undefined {
  const t = sections.find(
    (s): s is Extract<DocSection, { kind: 'table' }> =>
      s.kind === 'table' &&
      typeof s.title === 'string' &&
      /transition/i.test(s.title)
  );
  if (!t) return undefined;
  consumed.add(t);
  return { headers: t.headers, rows: t.rows };
}

const SIM_HEADER_PATTERN = ['#', 'Consumed', 'Remaining'];

function findSimulationTrace(
  sections: DocSection[],
  isDfa: boolean,
  consumed: Set<DocSection>
): AutomataMeta['simulation'] {
  const t = sections.find(
    (s): s is Extract<DocSection, { kind: 'table' }> =>
      s.kind === 'table' &&
      SIM_HEADER_PATTERN.every((h, i) => s.headers[i] === h)
  );
  if (!t) return undefined;
  consumed.add(t);
  // The engine's verdict is written as a text-block (typically untitled) whose
  // first line starts with "Result:" — e.g. "Result: ACCEPTED" or "Result: rejected".
  const resultBlock = sections.find(
    (s): s is Extract<DocSection, { kind: 'text-block' }> =>
      s.kind === 'text-block' &&
      s.lines.some((l) => /^result\b/i.test(l.trim()))
  );
  if (resultBlock) consumed.add(resultBlock);

  // Each row: [index, consumed, remaining, activeStatesStringOrSingle]
  const steps: AutomataSimStep[] = t.rows.map((row) => {
    const index = Number(row[0]) || 0;
    const consumed = row[1] === 'ε' ? '' : row[1];
    const remaining = row[2] === 'ε' ? '' : row[2];
    const last = row[3] ?? '';
    const setMatch = last.match(/^\{(.*)\}$/);
    if (setMatch) {
      const inner = setMatch[1].trim();
      const states = inner
        ? inner.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      return { index, consumed, remaining, states };
    }
    if (isDfa) return { index, consumed, remaining, state: last };
    return { index, consumed, remaining, states: last ? [last] : [] };
  });

  let accepted = false;
  let reason: string | undefined;
  if (resultBlock) {
    const verdictLine = resultBlock.lines.find((l) =>
      /^result\b/i.test(l.trim())
    );
    if (verdictLine) {
      accepted = /accepted/i.test(verdictLine);
      reason = verdictLine.trim();
    }
  }

  // Derive input from concatenating last consumed + remaining (or first row's remaining).
  const first = t.rows[0];
  const input = first
    ? (first[1] === 'ε' ? '' : first[1]) +
      (first[2] === 'ε' ? '' : first[2])
    : '';

  return { input, accepted, reason, steps };
}
