import type { Domain, SolvedQuestion } from '@/engines/types';
import { solveAutomataQuestion } from '@/engines/automata';
import { solveControlQuestion } from '@/engines/control';
import { solveGraphicsQuestion } from '@/engines/graphics';

interface Seed {
  id: string;
  title: string;
  question: string;
}

const AUTOMATA_SEEDS: Seed[] = [
  {
    id: 'example-automata-end01',
    title: 'NFA / DFA: Strings ending in "01"',
    question: 'Construct an NFA accepting strings ending in 01 over {0,1}',
  },
  {
    id: 'example-automata-div3',
    title: 'DFA: Binary strings divisible by 3',
    question: 'Build a DFA for binary strings divisible by 3',
  },
  {
    id: 'example-automata-even0',
    title: 'DFA: Even number of 0s',
    question: 'Construct a DFA accepting strings with an even number of 0 over {0,1}',
  },
  {
    id: 'example-automata-thompson',
    title: 'Thompson construction for (a|b)*abb',
    question: 'Thompson construction for (a|b)*abb',
  },
];

const GRAPHICS_SEEDS: Seed[] = [
  {
    id: 'example-graphics-point',
    title: 'Projection of a Point: 50mm above HP, 30mm in front of VP',
    question: 'Draw the projections of a point A which is 50mm above HP and 30mm in front of VP',
  },
  {
    id: 'example-graphics-line',
    title: 'Projection of a Line AB',
    question: 'Line AB. End A is 20mm above HP and 30mm in front of VP. End B is 60mm above HP and 70mm in front of VP.',
  },
  {
    id: 'example-graphics-inclined-line',
    title: 'Inclined Line: 80mm long, 30° to HP and 45° to VP',
    question: 'Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP.',
  },
  {
    id: 'example-graphics-pentagon-plane',
    title: 'Pentagon Plane Inclined 45° to HP',
    question: 'Projection of a pentagon of side 30mm inclined 45° to HP and perpendicular to VP',
  },
  {
    id: 'example-graphics-hex-pyramid',
    title: 'Hexagonal Pyramid — axis ⟂ HP',
    question: 'Projection of a hexagonal pyramid of base side 25mm and axis 60mm, axis perpendicular to HP',
  },
  {
    id: 'example-graphics-cone-section',
    title: 'Section of a Cone at 45°',
    question: 'Section of a cone of diameter 60mm and axis 80mm cut by a plane inclined 45° to HP through a point 30mm above the base',
  },
  {
    id: 'example-graphics-cone-dev',
    title: 'Development of a Cone',
    question: 'Development of the lateral surface of a cone of base diameter 60mm and axis 80mm',
  },
  {
    id: 'example-graphics-prism-dev',
    title: 'Development of a Hexagonal Prism',
    question: 'Development of the lateral surface of a hexagonal prism of base side 25mm and axis 60mm',
  },
  {
    id: 'example-graphics-ellipse',
    title: 'Ellipse: major 100mm, minor 60mm',
    question: 'Draw an ellipse of major axis 100mm and minor axis 60mm using the concentric circles method',
  },
  {
    id: 'example-graphics-hyperbola',
    title: 'Rectangular Hyperbola through (40, 30)mm',
    question: 'Draw a rectangular hyperbola through abscissa 40mm and ordinate 30mm with width 80mm and height 60mm',
  },
  {
    id: 'example-graphics-cycloid',
    title: 'Cycloid: rolling circle diameter 50mm',
    question: 'Draw a cycloid for a circle of diameter 50mm',
  },
  {
    id: 'example-graphics-epicycloid',
    title: 'Epicycloid (small Ø40 on large Ø120)',
    question: 'Draw an epicycloid with rolling circle of diameter 40mm on base circle of diameter 120mm',
  },
  {
    id: 'example-graphics-spiral',
    title: 'Archimedean Spiral — 2 turns to R 60mm',
    question: 'Draw an Archimedean spiral of 2 turns with final radius 60mm',
  },
  {
    id: 'example-graphics-helix',
    title: 'Cylindrical Helix — Ø50, pitch 40mm, 3 turns',
    question: 'Draw a helix on a cylinder of diameter 50mm and pitch 40mm for 3 turns',
  },
  {
    id: 'example-graphics-plain-scale',
    title: 'Plain Scale R.F. 1:50, reads 6 metres',
    question: 'Draw a plain scale of R.F. 1:50 to read up to 6 metres and decimetres',
  },
  {
    id: 'example-graphics-diag-scale',
    title: 'Diagonal Scale R.F. 1:100',
    question: 'Draw a diagonal scale of R.F. 1:100 to read up to 5 metres and decimetres and centimetres',
  },
  {
    id: 'example-graphics-iso-cube',
    title: 'Isometric: cube of side 40mm',
    question: 'Draw the isometric projection of a cube of side 40mm',
  },
  {
    id: 'example-graphics-orthographic',
    title: 'Orthographic Views: block 80×50×40mm',
    question: 'Draw the orthographic views of a block of width 80mm, depth 50mm and height 40mm in first-angle projection',
  },
];

const CONTROL_SEEDS: Seed[] = [
  {
    id: 'example-control-pz',
    title: 'Pole-Zero: G(s) = (s+2) / [(s+1)(s+3)]',
    question: 'Pole-zero plot for G(s) = (s+2) / ((s+1)(s+3))',
  },
  {
    id: 'example-control-routh',
    title: 'Routh-Hurwitz: s⁴ + 2s³ + 3s² + 4s + 5',
    question: 'Routh-Hurwitz stability for s^4 + 2s^3 + 3s^2 + 4s + 5',
  },
  {
    id: 'example-control-bode',
    title: 'Bode: G(s) = 10 / (s² + 2s + 10)',
    question: 'Bode plot for G(s) = 10 / (s^2 + 2s + 10)',
  },
];

function buildExample(domain: Domain, seed: Seed): SolvedQuestion | null {
  const result =
    domain === 'automata'
      ? solveAutomataQuestion(seed.question)
      : domain === 'control'
      ? solveControlQuestion(seed.question)
      : solveGraphicsQuestion(seed.question);
  if (!result.success) return null;
  return {
    id: seed.id,
    domain,
    title: seed.title,
    question: seed.question,
    summary: result.summary,
    paper: result.paper,
    strokes: result.strokes,
    createdAt: 0,
    isExample: true,
  };
}

function buildExamples(domain: Domain, seeds: Seed[]): SolvedQuestion[] {
  return seeds
    .map((s) => buildExample(domain, s))
    .filter((q): q is SolvedQuestion => q !== null);
}

export const ALL_EXAMPLES: Record<Domain, SolvedQuestion[]> = {
  graphics: buildExamples('graphics', GRAPHICS_SEEDS),
  automata: buildExamples('automata', AUTOMATA_SEEDS),
  control: buildExamples('control', CONTROL_SEEDS),
};

export function findExample(id: string): SolvedQuestion | null {
  for (const list of Object.values(ALL_EXAMPLES)) {
    const found = list.find((q) => q.id === id);
    if (found) return found;
  }
  return null;
}
