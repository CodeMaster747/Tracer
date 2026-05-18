import { paperSpec, type SolvedQuestion, type SolverResult } from '@/engines/types';
import { renderDocument } from './layout';
import { parseAutomataDoc } from './parser';
import { automataMetaFromDoc, isAutomataDiagramSection } from './meta';
import type { SolutionDoc } from './types';

export function solveAutomataQuestion(text: string): SolverResult {
  const result = parseAutomataDoc(text);

  if (!result.doc) {
    return {
      success: false,
      summary: result.refusal ?? 'Could not parse this question.',
      paper: paperSpec('A3', 'landscape'),
      strokes: [],
      refusalReason: result.refusal ?? 'unknown',
      manualInstructions: [
        'State the alphabet (e.g. {0,1} for binary).',
        'State the task: construct DFA/NFA/PDA/TM; convert NFA → DFA; minimize; build regex from DFA; build CNF/GNF; compute FIRST/FOLLOW; LL(1) table; parse tree.',
        'Provide a grammar with productions on each line, e.g. "S -> aSb | ε".',
        'For simulation/acceptance, add a string: "on input 1011" or "accept 1101".',
      ],
    };
  }

  // The paper canvas shows only diagram-kind sections. Title, summary,
  // descriptions, tables, derivations all flow into the sidebar via meta.
  const diagramDoc: SolutionDoc = {
    title: '',
    summary: '',
    sections: result.doc.sections.filter(isAutomataDiagramSection),
  };
  const { strokes, paperWidthMm, paperHeightMm } = renderDocument(diagramDoc);
  const paper = paperSpec(
    paperWidthMm > 420 || paperHeightMm > 297 ? 'A2' : 'A3',
    'landscape'
  );

  const meta = automataMetaFromDoc(result.doc) ?? undefined;

  return {
    success: true,
    summary: result.doc.summary,
    paper,
    strokes,
    meta,
  };
}

export function buildSolvedQuestion(
  questionText: string,
  domain: 'automata',
  id: string
): SolvedQuestion | null {
  const result = solveAutomataQuestion(questionText);
  if (!result.success) return null;
  return {
    id,
    domain,
    title: result.summary.split('.')[0].slice(0, 80),
    question: questionText,
    summary: result.summary,
    paper: result.paper,
    strokes: result.strokes,
    createdAt: Date.now(),
  };
}
