/**
 * Smoke test for the engineering graphics engine.
 *   npx tsx scripts/smoke-graphics.ts
 */
import { solveGraphicsQuestion } from '../src/engines/graphics';
import type { Stroke, StrokeGeometry, PaperSpec, Pt } from '../src/engines/types';

/**
 * The canvas clips to the paper rect, so a stroke outside the sheet is invisible on screen
 * and in the export. Treat that as a failure, not a pass.
 */
function extentPoints(g: StrokeGeometry): Pt[] {
  switch (g.kind) {
    case 'line':
    case 'arrow':
      return [
        { x: g.x1, y: g.y1 },
        { x: g.x2, y: g.y2 },
      ];
    case 'circle':
    case 'arc':
      return [
        { x: g.cx - g.r, y: g.cy - g.r },
        { x: g.cx + g.r, y: g.cy + g.r },
      ];
    case 'curve':
    case 'polygon':
      return g.points;
    case 'text':
      return [{ x: g.x, y: g.y }];
  }
}

function offSheetCount(strokes: Stroke[], paper: PaperSpec): number {
  let n = 0;
  for (const s of strokes) {
    const pts = extentPoints(s.geometry);
    if (pts.some((p) => p.x < 0 || p.y < 0 || p.x > paper.widthMm || p.y > paper.heightMm)) n++;
  }
  return n;
}

const cases = [
  // Points
  'Draw the projections of a point A which is 50mm above HP and 30mm in front of VP',
  'Draw the projections of point P 40mm below HP and 20mm in front of VP in third-angle projection',

  // Lines
  'Line AB. End A is 20mm above HP and 30mm in front of VP. End B is 60mm above HP and 70mm in front of VP.',
  'Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP.',

  // Planes
  'Projection of a triangle of side 50mm parallel to HP',
  'Projection of a pentagon of side 30mm inclined 45° to HP and perpendicular to VP',
  'Projection of a hexagon of side 25mm inclined 30° to VP and perpendicular to HP',
  'Projection of a circle of diameter 60mm parallel to VP',

  // Solids
  'Projection of a hexagonal pyramid of base side 25mm and axis 60mm, axis perpendicular to HP',
  'Projection of a cube of edge 40mm, axis perpendicular to HP',
  'Projection of a cone of base diameter 50mm and axis 70mm, axis inclined 30° to HP',
  'Projection of a triangular prism of base side 40mm and axis 60mm, axis perpendicular to VP',

  // Sections
  'Section of a cylinder of diameter 60mm and axis 80mm cut by a plane inclined 45° to HP through a point 30mm above the base',
  'Section of a hexagonal pyramid of base side 30mm and axis 60mm cut at 45° to HP',

  // Development
  'Development of the lateral surface of a hexagonal prism of base side 25mm and axis 60mm',
  'Development of the lateral surface of a cone of base diameter 60mm and axis 80mm',

  // Curves
  'Draw an ellipse of major axis 100mm and minor axis 60mm',
  'Draw a parabola with abscissa 80mm and ordinate 50mm',
  'Draw a rectangular hyperbola through abscissa 40mm and ordinate 30mm with width 100mm and height 80mm',
  'Draw a cycloid for a circle of diameter 50mm',
  'Draw an epicycloid with rolling circle of diameter 40mm on base circle of diameter 120mm',
  'Draw a hypocycloid with rolling circle of diameter 30mm on base circle of diameter 90mm',
  'Draw the involute of a circle of diameter 40mm',
  'Draw an Archimedean spiral of 2 turns with final radius 60mm',
  'Draw a helix on a cylinder of diameter 50mm and pitch 40mm for 3 turns',

  // Scales
  'Draw a plain scale of R.F. 1:50 to read up to 6 metres and decimetres',
  'Draw a diagonal scale of R.F. 1:100 to read up to 5 metres and decimetres and centimetres',
  'Draw a forward vernier scale of R.F. 1:20 to read up to 4 metres',
  'Draw a comparative scale of R.F. 1:50000 to read km and miles up to 10 km',

  // Iso & ortho
  'Draw the isometric projection of a cube of side 30mm',
  'Isometric projection of a cylinder with diameter 50mm and height 80mm',
  'Isometric projection of a cone with base diameter 50mm and height 80mm',
  'Draw the orthographic views of a block of width 80mm, depth 50mm and height 40mm in first-angle projection',
  'Auxiliary view of an inclined face tilted 45° to HP on a block of width 60mm, depth 40mm and height 50mm',

  // Should refuse
  'Random unrelated question that should refuse',
  'Where are my keys?',
];

let ok = 0;
let no = 0;
const failures: string[] = [];

for (const c of cases) {
  const r = solveGraphicsQuestion(c);
  if (r.success) {
    const off = offSheetCount(r.strokes, r.paper);
    if (off > 0) {
      console.log(`OFF | ${c.slice(0, 90)}`);
      console.log(
        `    ${off}/${r.strokes.length} strokes fall outside the ${r.paper.size} ${r.paper.orientation} sheet — they would be clipped`
      );
      failures.push(`${c} (${off} stroke(s) off-sheet)`);
    } else {
      console.log(`OK  | ${c.slice(0, 90)}`);
      console.log(`    strokes: ${r.strokes.length}, summary: ${r.summary.slice(0, 90)}…`);
    }
    ok++;
  } else {
    console.log(`NO  | ${c.slice(0, 90)}`);
    console.log(`    refusal: ${r.refusalReason?.slice(0, 100)}`);
    no++;
    if (!c.toLowerCase().includes('random') && !c.toLowerCase().includes('keys')) {
      failures.push(c);
    }
  }
  console.log();
}

console.log(`\n--- Summary: ${ok} success, ${no} refusal ---`);
if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
