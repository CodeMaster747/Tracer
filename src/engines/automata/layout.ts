import type { Pt, Stroke } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import type { Automaton, AutomatonView, DocSection, ParseTreeNode, SolutionDoc } from './types';
import { layoutTree } from './parseTree';

const STATE_RADIUS = 14;
const ACCEPT_OUTER_GAP = 3;

interface LaidOut {
  positions: Map<string, Pt>;
}

interface AutomatonRenderResult {
  heightUsed: number;
}

function unitVec(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
function add(a: Pt, b: Pt): Pt { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: Pt, b: Pt): Pt { return { x: a.x - b.x, y: a.y - b.y }; }
function scale(a: Pt, s: number): Pt { return { x: a.x * s, y: a.y * s }; }
function perp(a: Pt): Pt { return { x: -a.y, y: a.x }; }

function layoutStates(
  automaton: Automaton,
  hint: AutomatonView['layout'],
  area: { x: number; y: number; width: number; height: number }
): LaidOut {
  const n = automaton.states.length;
  const positions = new Map<string, Pt>();
  if (n === 0) return { positions };

  const horizontalPad = 60;

  if (hint === 'two-rows' || (n > 5 && hint !== 'circle' && hint !== 'row')) {
    const cols = Math.ceil(n / 2);
    const usable = area.width - 2 * horizontalPad;
    const dx = cols > 1 ? usable / (cols - 1) : 0;
    const cy = area.y + area.height / 2;
    const y1 = cy - 30;
    const y2 = cy + 30;
    automaton.states.forEach((s, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = area.x + horizontalPad + col * dx;
      positions.set(s, { x, y: row === 0 ? y1 : y2 });
    });
  } else if (hint === 'circle' || n > 8) {
    const cx = area.x + area.width / 2;
    const cy = area.y + area.height / 2;
    const radius = Math.min(area.height / 2 - 30, 30 + n * 8);
    automaton.states.forEach((s, i) => {
      const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      positions.set(s, {
        x: cx + radius * Math.cos(theta),
        y: cy + radius * Math.sin(theta),
      });
    });
  } else {
    const usable = area.width - 2 * horizontalPad;
    const dx = n > 1 ? usable / (n - 1) : 0;
    const y = area.y + area.height / 2;
    automaton.states.forEach((s, i) => {
      positions.set(s, { x: area.x + horizontalPad + i * dx, y });
    });
  }
  return { positions };
}

function buildArrowSet(automaton: Automaton): Map<string, { from: string; to: string; labels: string[] }> {
  const map = new Map<string, { from: string; to: string; labels: string[] }>();
  for (const [from, row] of automaton.delta) {
    for (const [sym, set] of row) {
      for (const to of set) {
        const key = `${from}__${to}`;
        let entry = map.get(key);
        if (!entry) {
          entry = { from, to, labels: [] };
          map.set(key, entry);
        }
        entry.labels.push(sym === '' ? 'ε' : sym);
      }
    }
  }
  return map;
}

/**
 * Render an automaton diagram into a builder within the given area.
 * Returns the actual height used.
 */
function renderAutomaton(
  builder: StrokeBuilder,
  view: AutomatonView,
  area: { x: number; y: number; width: number; height: number }
): AutomatonRenderResult {
  // Title
  builder.text({
    instruction: 'Title',
    at: { x: area.x + area.width / 2, y: area.y + 8 },
    text: view.title,
    align: 'middle',
    fontSize: 6,
  });

  const stateArea = {
    x: area.x,
    y: area.y + 16,
    width: area.width,
    height: area.height - 30,
  };
  const { positions } = layoutStates(view, view.layout, stateArea);

  // Draw states
  for (const state of view.states) {
    const pos = positions.get(state);
    if (!pos) continue;
    const isStart = state === view.start;
    const isAccepting = view.accepting.has(state);
    const marker = isStart ? 'start' : isAccepting ? 'accepting' : undefined;

    builder.circle({
      tool: 'Compass',
      instruction: `Draw state ${state}${isStart ? ' (start)' : ''}${isAccepting ? ' (accepting)' : ''}`,
      center: pos,
      radius: STATE_RADIUS,
      layer: 'final',
      marker,
    });
    if (isAccepting) {
      builder.circle({
        tool: 'Compass',
        instruction: `Outer ring for accepting state ${state}`,
        center: pos,
        radius: STATE_RADIUS + ACCEPT_OUTER_GAP,
        layer: 'final',
        marker: 'accepting',
      });
    }
    if (isStart) {
      const tipOffset = STATE_RADIUS + 1;
      builder.arrow({
        tool: 'HB Pencil',
        instruction: `Start arrow into ${state}`,
        from: { x: pos.x - tipOffset - 24, y: pos.y },
        to: { x: pos.x - tipOffset, y: pos.y },
        layer: 'final',
        marker: 'start',
      });
    }
    builder.text({
      instruction: `Label state ${state}`,
      at: { x: pos.x, y: pos.y + 1 },
      text: state,
      align: 'middle',
      baseline: 'middle',
      fontSize: 4.5,
      marker,
    });

    // Moore output below state
    if (view.outputMode === 'moore' && view.outputs?.has(state)) {
      const o = view.outputs.get(state) || '';
      builder.text({
        instruction: `Moore output for ${state}`,
        at: { x: pos.x, y: pos.y + STATE_RADIUS + 6 },
        text: `/${o}`,
        align: 'middle',
        fontSize: 3.8,
      });
    }
  }

  // Transitions
  const arrows = buildArrowSet(view);
  for (const { from, to, labels } of arrows.values()) {
    const a = positions.get(from);
    const b = positions.get(to);
    if (!a || !b) continue;
    // For Mealy: enrich labels with /output
    const decoratedLabels = labels.map((l) => {
      if (view.outputMode === 'mealy') {
        const sym = l === 'ε' ? '' : l;
        const out = view.outputs?.get(`${from}|${sym}|${to}`);
        if (out !== undefined) return `${l}/${out}`;
      }
      return l;
    });
    const label = decoratedLabels.join(', ');

    if (from === to) {
      const cx = a.x;
      const cy = a.y - STATE_RADIUS - 8;
      builder.arc({
        tool: 'HB Pencil',
        instruction: `Self-loop on ${from}: ${label}`,
        center: { x: cx, y: cy },
        radius: 8,
        startAngle: Math.PI * 0.3,
        endAngle: Math.PI * 0.7,
        anticlockwise: true,
        layer: 'final',
      });
      builder.text({
        instruction: `Label self-loop "${label}"`,
        at: { x: cx, y: cy - 8 },
        text: label,
        align: 'middle',
        fontSize: 3.8,
      });
    } else {
      const u = unitVec(a, b);
      const start = add(a, scale(u, STATE_RADIUS));
      const end = sub(b, scale(u, STATE_RADIUS + 1));
      // If reverse edge also exists, curve labels to avoid overlap
      const hasReverse = arrows.has(`${to}__${from}`);
      if (hasReverse) {
        const midpoint = scale(add(start, end), 0.5);
        const off = scale(perp(u), -4);
        const ctrl = add(midpoint, off);
        builder.curve({
          tool: 'HB Pencil',
          instruction: `Transition ${from} → ${to} on ${label}`,
          points: [start, ctrl, end],
          layer: 'final',
        });
        builder.text({
          instruction: `Label ${from}→${to}: ${label}`,
          at: add(ctrl, scale(perp(u), -3)),
          text: label,
          align: 'middle',
          fontSize: 3.8,
        });
      } else {
        builder.arrow({
          tool: 'HB Pencil',
          instruction: `Transition ${from} → ${to} on ${label}`,
          from: start,
          to: end,
          layer: 'final',
        });
        const midpoint = scale(add(start, end), 0.5);
        const off = scale(perp(u), -5);
        builder.text({
          instruction: `Label transition ${from}→${to}: ${label}`,
          at: add(midpoint, off),
          text: label,
          align: 'middle',
          fontSize: 3.8,
        });
      }
    }
  }
  return { heightUsed: area.height };
}

/* ------------------------------------------------------------------ */
/* Text and table sections                                             */
/* ------------------------------------------------------------------ */

function renderTextBlock(
  builder: StrokeBuilder,
  opts: { title?: string; lines: string[]; mono?: boolean },
  area: { x: number; y: number; width: number }
): { heightUsed: number } {
  let y = area.y;
  if (opts.title) {
    builder.text({
      instruction: 'Section title',
      at: { x: area.x + 8, y: y + 4 },
      text: opts.title,
      fontSize: 5,
      align: 'start',
    });
    y += 8;
  }
  const lineH = 5;
  for (const line of opts.lines) {
    builder.text({
      instruction: 'Text line',
      at: { x: area.x + 12, y: y + 3 },
      text: line,
      fontSize: opts.mono ? 4 : 4.2,
      align: 'start',
    });
    y += lineH;
  }
  return { heightUsed: y - area.y + 2 };
}

function renderTable(
  builder: StrokeBuilder,
  opts: { title?: string; headers: string[]; rows: string[][] },
  area: { x: number; y: number; width: number }
): { heightUsed: number } {
  let y = area.y;
  if (opts.title) {
    builder.text({
      instruction: 'Table title',
      at: { x: area.x + 8, y: y + 4 },
      text: opts.title,
      fontSize: 5,
      align: 'start',
    });
    y += 8;
  }
  const ncol = opts.headers.length;
  const colW = (area.width - 16) / Math.max(ncol, 1);
  const rowH = 7;

  const drawRow = (cells: string[], rowY: number, bold: boolean) => {
    for (let i = 0; i < cells.length; i++) {
      const x = area.x + 8 + i * colW;
      builder.line({
        tool: 'HB Pencil',
        instruction: 'Cell border',
        from: { x, y: rowY },
        to: { x: x + colW, y: rowY },
        layer: 'final',
      });
      builder.text({
        instruction: 'Cell text',
        at: { x: x + colW / 2, y: rowY + rowH / 2 + 0.5 },
        text: cells[i] ?? '',
        align: 'middle',
        baseline: 'middle',
        fontSize: bold ? 4 : 3.8,
      });
    }
    // vertical borders
    for (let i = 0; i <= cells.length; i++) {
      const x = area.x + 8 + i * colW;
      builder.line({
        tool: 'HB Pencil',
        instruction: 'Cell border',
        from: { x, y: rowY },
        to: { x, y: rowY + rowH },
        layer: 'final',
      });
    }
  };
  drawRow(opts.headers, y, true);
  y += rowH;
  for (const r of opts.rows) {
    drawRow(r, y, false);
    y += rowH;
  }
  // Bottom border of last row
  for (let i = 0; i <= ncol; i++) {
    const x = area.x + 8 + i * colW;
    builder.line({
      tool: 'HB Pencil',
      instruction: 'Cell border',
      from: { x, y },
      to: { x, y },
      layer: 'final',
    });
  }
  // Final line under last row
  for (let i = 0; i < ncol; i++) {
    const x = area.x + 8 + i * colW;
    builder.line({
      tool: 'HB Pencil',
      instruction: 'Cell border',
      from: { x, y },
      to: { x: x + colW, y },
      layer: 'final',
    });
  }
  return { heightUsed: y - area.y + 4 };
}

function renderParseTree(
  builder: StrokeBuilder,
  opts: { title?: string; root: ParseTreeNode },
  area: { x: number; y: number; width: number }
): { heightUsed: number } {
  let y = area.y;
  if (opts.title) {
    builder.text({
      instruction: 'Parse tree title',
      at: { x: area.x + 8, y: y + 4 },
      text: opts.title,
      fontSize: 5,
      align: 'start',
    });
    y += 8;
  }
  const layout = layoutTree(opts.root, { xUnit: 16, yUnit: 18 });
  // Center horizontally
  const xs = [...layout.positions.values()].map((p) => p.x);
  const minX = Math.min(...xs);
  const treeW = layout.width;
  const offsetX = area.x + (area.width - treeW) / 2 - minX;
  const offsetY = y + 8;

  const place = (node: ParseTreeNode) => {
    const pos = layout.positions.get(node)!;
    const at = { x: pos.x + offsetX, y: pos.y + offsetY };
    builder.text({
      instruction: `Tree node ${node.label}`,
      at,
      text: node.label,
      align: 'middle',
      baseline: 'middle',
      fontSize: 4,
    });
    for (const c of node.children) {
      const cpos = layout.positions.get(c)!;
      const cat = { x: cpos.x + offsetX, y: cpos.y + offsetY };
      builder.line({
        tool: 'HB Pencil',
        instruction: `Edge ${node.label}-${c.label}`,
        from: { x: at.x, y: at.y + 3 },
        to: { x: cat.x, y: cat.y - 3 },
        layer: 'final',
      });
      place(c);
    }
  };
  place(opts.root);
  return { heightUsed: layout.height + 20 };
}

function renderTMTape(
  builder: StrokeBuilder,
  opts: { title?: string; tape: string[]; head: number; state: string },
  area: { x: number; y: number; width: number }
): { heightUsed: number } {
  let y = area.y;
  if (opts.title) {
    builder.text({
      instruction: 'TM tape title',
      at: { x: area.x + 8, y: y + 4 },
      text: opts.title,
      fontSize: 5,
      align: 'start',
    });
    y += 8;
  }
  const cellW = Math.min(10, (area.width - 16) / Math.max(opts.tape.length, 1));
  const cellH = 8;
  const baseX = area.x + 8;
  for (let i = 0; i < opts.tape.length; i++) {
    const x = baseX + i * cellW;
    builder.line({
      tool: 'HB Pencil',
      instruction: 'Tape cell',
      from: { x, y },
      to: { x: x + cellW, y },
      layer: 'final',
    });
    builder.line({
      tool: 'HB Pencil',
      instruction: 'Tape cell',
      from: { x, y: y + cellH },
      to: { x: x + cellW, y: y + cellH },
      layer: 'final',
    });
    builder.line({
      tool: 'HB Pencil',
      instruction: 'Tape cell',
      from: { x, y },
      to: { x, y: y + cellH },
      layer: 'final',
    });
    builder.text({
      instruction: 'Tape symbol',
      at: { x: x + cellW / 2, y: y + cellH / 2 + 0.5 },
      text: opts.tape[i],
      align: 'middle',
      baseline: 'middle',
      fontSize: 4,
    });
  }
  // rightmost border
  const rx = baseX + opts.tape.length * cellW;
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Tape border',
    from: { x: rx, y },
    to: { x: rx, y: y + cellH },
    layer: 'final',
  });
  // Head pointer
  const hx = baseX + opts.head * cellW + cellW / 2;
  builder.arrow({
    tool: 'HB Pencil',
    instruction: `Head pointer (state ${opts.state})`,
    from: { x: hx, y: y + cellH + 6 },
    to: { x: hx, y: y + cellH + 1 },
    layer: 'final',
    marker: 'start',
  });
  builder.text({
    instruction: 'State label',
    at: { x: hx, y: y + cellH + 11 },
    text: opts.state,
    align: 'middle',
    fontSize: 3.8,
    marker: 'start',
  });
  return { heightUsed: cellH + 16 };
}

function renderDerivation(
  builder: StrokeBuilder,
  opts: { title?: string; steps: string[] },
  area: { x: number; y: number; width: number }
): { heightUsed: number } {
  let y = area.y;
  if (opts.title) {
    builder.text({
      instruction: 'Derivation title',
      at: { x: area.x + 8, y: y + 4 },
      text: opts.title,
      fontSize: 5,
      align: 'start',
    });
    y += 8;
  }
  for (const step of opts.steps) {
    builder.text({
      instruction: 'Derivation step',
      at: { x: area.x + 12, y: y + 3 },
      text: step,
      fontSize: 4,
      align: 'start',
    });
    y += 5;
  }
  return { heightUsed: y - area.y + 2 };
}

/* ------------------------------------------------------------------ */
/* Master entry points                                                 */
/* ------------------------------------------------------------------ */

function sectionHeightEstimate(section: DocSection): number {
  switch (section.kind) {
    case 'automaton': {
      const n = section.view.states.length;
      if (section.view.layout === 'two-rows' || n > 5) return 130;
      if (section.view.layout === 'circle') return 150;
      return 90;
    }
    case 'text-block':
      return (section.title ? 10 : 0) + (section.lines.length || 1) * 5 + 4;
    case 'table':
      return (section.title ? 10 : 0) + (section.rows.length + 1) * 7 + 6;
    case 'parse-tree': {
      const depth = depthOf(section.root);
      return (section.title ? 10 : 0) + depth * 20 + 16;
    }
    case 'tm-tape':
      return (section.title ? 10 : 0) + 24;
    case 'derivation':
      return (section.title ? 10 : 0) + (section.steps.length || 1) * 5 + 4;
  }
}

function depthOf(n: ParseTreeNode): number {
  if (n.children.length === 0) return 1;
  return 1 + Math.max(...n.children.map(depthOf));
}

/**
 * Render a complete SolutionDoc, choosing paper height to fit all sections.
 */
export function renderDocument(doc: SolutionDoc): {
  strokes: Stroke[];
  paperWidthMm: number;
  paperHeightMm: number;
} {
  const paperWidth = 420;
  // Layout reserves space only for non-empty title/summary; callers that
  // want a diagram-only paper pass empty strings to skip both bands.
  const hasTitle = doc.title.trim().length > 0;
  const hasSummary = doc.summary.trim().length > 0;
  const titleHeight = hasTitle ? 12 : 0;
  const summaryHeight = hasSummary
    ? Math.max(8, Math.ceil(doc.summary.length / 70) * 5)
    : 0;
  const sectionsHeight = doc.sections.reduce((a, s) => a + sectionHeightEstimate(s) + 6, 0);
  const totalHeight = Math.max(297, titleHeight + summaryHeight + sectionsHeight + 30);
  // Pad up to A2 when very tall, else A3
  const paperHeight = totalHeight > 297 ? Math.min(594, totalHeight + 10) : 297;

  const builder = new StrokeBuilder();

  let y = hasTitle ? 22 : 12;
  if (hasTitle) {
    builder.text({
      instruction: 'Document title',
      at: { x: paperWidth / 2, y: 14 },
      text: doc.title,
      align: 'middle',
      fontSize: 7,
    });
  }
  if (hasSummary) {
    const wrap = wrapText(doc.summary, 80);
    for (const line of wrap) {
      builder.text({
        instruction: 'Summary',
        at: { x: paperWidth / 2, y },
        text: line,
        align: 'middle',
        fontSize: 4,
      });
      y += 5;
    }
    y += 4;
  }

  for (const section of doc.sections) {
    const h = sectionHeightEstimate(section);
    const area = { x: 10, y, width: paperWidth - 20, height: h };
    switch (section.kind) {
      case 'automaton':
        renderAutomaton(builder, section.view, area);
        break;
      case 'text-block':
        renderTextBlock(builder, section, area);
        break;
      case 'table':
        renderTable(builder, section, area);
        break;
      case 'parse-tree':
        renderParseTree(builder, section, area);
        break;
      case 'tm-tape':
        renderTMTape(builder, section, area);
        break;
      case 'derivation':
        renderDerivation(builder, section, area);
        break;
    }
    y += h + 6;
  }

  return {
    strokes: builder.build(),
    paperWidthMm: paperWidth,
    paperHeightMm: paperHeight,
  };
}

function wrapText(s: string, maxLen: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxLen) {
      out.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Backward-compat: render a single AutomatonView at full-paper scale.
 * The new path is `renderDocument`, but several callers still use this.
 */
export function automatonToStrokes(view: AutomatonView): {
  strokes: Stroke[];
  paperWidthMm: number;
  paperHeightMm: number;
} {
  return renderDocument({
    title: view.title,
    summary: view.summary,
    sections: [{ kind: 'automaton', view }],
  });
}
