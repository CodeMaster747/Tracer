/**
 * Multi-section ControlDoc renderer.
 *
 * Each section in a ControlDoc maps to a panel on the page. The renderer auto-paginates
 * vertically by accumulating heights, switching between A3 and A2 paper as needed.
 */
import type { Stroke, Pt } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import type {
  ControlDoc,
  ControlSection,
  XYSeries,
  BlockDiagram,
  SignalFlowGraph,
  Complex,
} from './controlTypes';

interface Box {
  x: number; y: number; width: number; height: number;
}

/* ============================================================ */
/* Helpers                                                       */
/* ============================================================ */

function fmtNum(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  if (Math.abs(x) < 1e-12) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  if (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e4) return x.toExponential(2);
  return Number(x.toPrecision(4)).toString();
}

function fmtCx(z: Complex): string {
  if (Math.abs(z.im) < 1e-9) return fmtNum(z.re);
  if (Math.abs(z.re) < 1e-9) return `${fmtNum(z.im)}j`;
  const sign = z.im >= 0 ? '+' : '-';
  return `${fmtNum(z.re)} ${sign} ${fmtNum(Math.abs(z.im))}j`;
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const frac = rough / 10 ** exp;
  let nice;
  if (frac <= 1.5) nice = 1;
  else if (frac <= 3) nice = 2;
  else if (frac <= 7) nice = 5;
  else nice = 10;
  return nice * 10 ** exp;
}

function niceTicksLinear(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const step = niceStep(range / count);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    out.push(Math.round(v * 1000) / 1000);
  }
  return out;
}

function niceTicksLog(min: number, max: number): number[] {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}

/* ============================================================ */
/* Text + Equation                                               */
/* ============================================================ */

function renderText(builder: StrokeBuilder, opts: { title?: string; lines: string[]; mono?: boolean }, box: Box): number {
  let y = box.y + 4;
  if (opts.title) {
    builder.text({ instruction: 'Section title', at: { x: box.x + 6, y }, text: opts.title, fontSize: 5.5, align: 'start' });
    y += 7;
  }
  for (const line of opts.lines) {
    builder.text({
      instruction: 'Text',
      at: { x: box.x + 10, y: y + 3 },
      text: line,
      fontSize: opts.mono ? 4 : 4.2,
      align: 'start',
    });
    y += 5;
  }
  return y - box.y + 4;
}

function renderEquation(builder: StrokeBuilder, opts: { title?: string; lines: string[] }, box: Box): number {
  let y = box.y + 4;
  if (opts.title) {
    builder.text({ instruction: 'Equation title', at: { x: box.x + 6, y }, text: opts.title, fontSize: 5.5, align: 'start' });
    y += 7;
  }
  for (const line of opts.lines) {
    builder.text({
      instruction: 'Equation line',
      at: { x: box.x + box.width / 2, y: y + 4 },
      text: line,
      fontSize: 5,
      align: 'middle',
    });
    y += 7;
  }
  return y - box.y + 4;
}

/* ============================================================ */
/* Matrix                                                        */
/* ============================================================ */

function renderMatrix(builder: StrokeBuilder, opts: { title?: string; name: string; data: number[][] }, box: Box): number {
  let y = box.y + 4;
  if (opts.title) {
    builder.text({ instruction: 'Matrix title', at: { x: box.x + 6, y }, text: opts.title, fontSize: 5.5, align: 'start' });
    y += 7;
  }
  const rows = opts.data.length;
  if (rows === 0) return y - box.y + 4;
  const cols = opts.data[0]?.length ?? 0;
  const cellW = 18;
  const cellH = 7;
  const startX = box.x + 20;
  builder.text({
    instruction: 'Matrix name',
    at: { x: startX - 14, y: y + (rows * cellH) / 2 + 2 },
    text: `${opts.name} =`,
    align: 'end',
    fontSize: 5,
  });
  // Brackets
  builder.line({ tool: 'HB Pencil', instruction: 'Matrix [', from: { x: startX - 4, y }, to: { x: startX - 4, y: y + rows * cellH }, layer: 'final' });
  builder.line({ tool: 'HB Pencil', instruction: 'Matrix [ top', from: { x: startX - 4, y }, to: { x: startX - 2, y }, layer: 'final' });
  builder.line({ tool: 'HB Pencil', instruction: 'Matrix [ bot', from: { x: startX - 4, y: y + rows * cellH }, to: { x: startX - 2, y: y + rows * cellH }, layer: 'final' });
  const endX = startX + cols * cellW;
  builder.line({ tool: 'HB Pencil', instruction: 'Matrix ]', from: { x: endX, y }, to: { x: endX, y: y + rows * cellH }, layer: 'final' });
  builder.line({ tool: 'HB Pencil', instruction: 'Matrix ] top', from: { x: endX - 2, y }, to: { x: endX, y }, layer: 'final' });
  builder.line({ tool: 'HB Pencil', instruction: 'Matrix ] bot', from: { x: endX - 2, y: y + rows * cellH }, to: { x: endX, y: y + rows * cellH }, layer: 'final' });

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      builder.text({
        instruction: `${opts.name}[${i},${j}] = ${fmtNum(opts.data[i][j])}`,
        at: { x: startX + j * cellW + cellW / 2, y: y + i * cellH + cellH / 2 + 1.5 },
        text: fmtNum(opts.data[i][j]),
        align: 'middle',
        baseline: 'middle',
        fontSize: 4,
      });
    }
  }
  return rows * cellH + (opts.title ? 7 : 0) + 6;
}

/* ============================================================ */
/* Table                                                         */
/* ============================================================ */

function renderTable(builder: StrokeBuilder, opts: { title?: string; headers: string[]; rows: string[][]; highlightFirstCol?: boolean }, box: Box): number {
  let y = box.y + 4;
  if (opts.title) {
    builder.text({ instruction: 'Table title', at: { x: box.x + 6, y }, text: opts.title, fontSize: 5.5, align: 'start' });
    y += 7;
  }
  const ncol = opts.headers.length;
  const colW = (box.width - 12) / Math.max(ncol, 1);
  const rowH = 7;

  const drawRow = (cells: string[], rowY: number, bold: boolean) => {
    for (let i = 0; i < cells.length; i++) {
      const x = box.x + 6 + i * colW;
      builder.text({
        instruction: 'Cell',
        at: { x: x + colW / 2, y: rowY + rowH / 2 + 0.5 },
        text: cells[i] ?? '',
        align: 'middle',
        baseline: 'middle',
        fontSize: bold ? 4.2 : 4,
      });
    }
    for (let i = 0; i <= cells.length; i++) {
      const x = box.x + 6 + i * colW;
      builder.line({ tool: 'HB Pencil', instruction: 'Vertical', from: { x, y: rowY }, to: { x, y: rowY + rowH }, layer: 'final' });
    }
    builder.line({ tool: 'HB Pencil', instruction: 'Top', from: { x: box.x + 6, y: rowY }, to: { x: box.x + 6 + ncol * colW, y: rowY }, layer: 'final' });
  };
  drawRow(opts.headers, y, true);
  y += rowH;
  for (const r of opts.rows) {
    drawRow(r, y, false);
    y += rowH;
  }
  builder.line({
    tool: 'HB Pencil',
    instruction: 'Bottom',
    from: { x: box.x + 6, y },
    to: { x: box.x + 6 + ncol * colW, y },
    layer: 'final',
  });
  return y - box.y + 4;
}

/* ============================================================ */
/* Pole-Zero                                                     */
/* ============================================================ */

function renderPoleZero(builder: StrokeBuilder, opts: { title?: string; poles: Complex[]; zeros: Complex[]; annotateZeta?: boolean }, box: Box): number {
  let y = box.y;
  if (opts.title) {
    builder.text({ instruction: 'Pole-zero title', at: { x: box.x + 6, y: y + 5 }, text: opts.title, fontSize: 5.5, align: 'start' });
    y += 8;
  }
  const plotH = box.height - (opts.title ? 8 : 0) - 4;
  const cx = box.x + box.width / 2;
  const cy = y + plotH / 2;
  // scale
  let maxAbs = 1;
  for (const r of [...opts.poles, ...opts.zeros]) {
    if (Math.abs(r.re) > maxAbs) maxAbs = Math.abs(r.re);
    if (Math.abs(r.im) > maxAbs) maxAbs = Math.abs(r.im);
  }
  maxAbs = Math.max(1, Math.ceil(maxAbs * 1.3));
  const halfX = (box.width - 30) / 2;
  const halfY = (plotH - 20) / 2;
  const unit = Math.max(1, Math.min(halfX, halfY) / maxAbs);

  // axes
  builder.arrow({ tool: 'T-Square', instruction: 'Real axis σ', from: { x: cx - halfX, y: cy }, to: { x: cx + halfX, y: cy }, layer: 'final' });
  builder.text({ instruction: 'σ label', at: { x: cx + halfX + 3, y: cy + 1 }, text: 'σ', align: 'start', baseline: 'middle', fontSize: 4.5 });
  builder.arrow({ tool: 'Set Square', instruction: 'Imag axis jω', from: { x: cx, y: cy + halfY }, to: { x: cx, y: cy - halfY }, layer: 'final' });
  builder.text({ instruction: 'jω label', at: { x: cx, y: cy - halfY - 3 }, text: 'jω', align: 'middle', fontSize: 4.5 });
  builder.text({ instruction: 'origin', at: { x: cx + 2, y: cy + 4 }, text: '0', align: 'start', fontSize: 3.5 });

  // gridlines for integers
  for (let v = -maxAbs; v <= maxAbs; v++) {
    if (v === 0) continue;
    const px = cx + v * unit;
    const py = cy - v * unit;
    if (Math.abs(px - cx) < halfX) {
      builder.line({ tool: '2H Pencil', instruction: `tick σ=${v}`, from: { x: px, y: cy - 1 }, to: { x: px, y: cy + 1 }, layer: 'construction' });
    }
    if (Math.abs(py - cy) < halfY) {
      builder.line({ tool: '2H Pencil', instruction: `tick ω=${v}`, from: { x: cx - 1, y: py }, to: { x: cx + 1, y: py }, layer: 'construction' });
    }
  }

  for (const z of opts.zeros) {
    const px = cx + z.re * unit;
    const py = cy - z.im * unit;
    builder.circle({ tool: 'Compass', instruction: `zero at s=${fmtCx(z)}`, center: { x: px, y: py }, radius: 2.5, layer: 'final' });
    builder.text({ instruction: 'zero label', at: { x: px + 3, y: py - 3 }, text: fmtCx(z), fontSize: 3.5 });
  }
  for (const p of opts.poles) {
    const px = cx + p.re * unit;
    const py = cy - p.im * unit;
    builder.line({ tool: 'HB Pencil', instruction: `pole at s=${fmtCx(p)} (1)`, from: { x: px - 2.5, y: py - 2.5 }, to: { x: px + 2.5, y: py + 2.5 }, layer: 'final' });
    builder.line({ tool: 'HB Pencil', instruction: `pole at s=${fmtCx(p)} (2)`, from: { x: px - 2.5, y: py + 2.5 }, to: { x: px + 2.5, y: py - 2.5 }, layer: 'final' });
    builder.text({ instruction: 'pole label', at: { x: px + 3, y: py - 3 }, text: fmtCx(p), fontSize: 3.5 });
  }
  return plotH + (opts.title ? 8 : 0);
}

/* ============================================================ */
/* XY Plot                                                       */
/* ============================================================ */

function renderXY(builder: StrokeBuilder, opts: {
  title?: string; series: XYSeries[]; xLabel: string; yLabel: string;
  xLog?: boolean; yLog?: boolean; gridDecades?: boolean;
  vlines?: { x: number; label?: string; style?: 'dashed' | 'dotted' }[];
  hlines?: { y: number; label?: string; style?: 'dashed' | 'dotted' }[];
}, box: Box): number {
  let y = box.y;
  if (opts.title) {
    builder.text({ instruction: 'XY title', at: { x: box.x + box.width / 2, y: y + 5 }, text: opts.title, fontSize: 5.5, align: 'middle' });
    y += 9;
  }
  const left = box.x + 18;
  const top = y + 4;
  const wPlot = box.width - 24;
  const hPlot = box.height - (y - box.y) - 22;

  // Determine data range
  let xMin = +Infinity, xMax = -Infinity, yMin = +Infinity, yMax = -Infinity;
  for (const s of opts.series) {
    for (let i = 0; i < s.xs.length; i++) {
      let xv = s.xs[i];
      let yv = s.ys[i];
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
      if (opts.xLog) xv = Math.log10(Math.max(xv, 1e-12));
      if (opts.yLog) yv = Math.log10(Math.max(yv, 1e-12));
      if (xv < xMin) xMin = xv;
      if (xv > xMax) xMax = xv;
      if (yv < yMin) yMin = yv;
      if (yv > yMax) yMax = yv;
    }
  }
  if (!Number.isFinite(xMin)) { xMin = 0; xMax = 1; }
  if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const pad = (yMax - yMin) * 0.05;
  yMin -= pad; yMax += pad;

  // axes
  builder.line({ tool: 'T-Square', instruction: 'X axis', from: { x: left, y: top + hPlot }, to: { x: left + wPlot, y: top + hPlot }, layer: 'final' });
  builder.line({ tool: 'Set Square', instruction: 'Y axis', from: { x: left, y: top }, to: { x: left, y: top + hPlot }, layer: 'final' });
  builder.line({ tool: 'T-Square', instruction: 'Top border', from: { x: left, y: top }, to: { x: left + wPlot, y: top }, layer: 'construction' });
  builder.line({ tool: 'Set Square', instruction: 'Right border', from: { x: left + wPlot, y: top }, to: { x: left + wPlot, y: top + hPlot }, layer: 'construction' });

  // ticks
  const xTicks = opts.xLog ? niceTicksLog(xMin, xMax) : niceTicksLinear(xMin, xMax, 6);
  for (const t of xTicks) {
    const px = left + ((t - xMin) / (xMax - xMin || 1)) * wPlot;
    builder.line({ tool: 'HB Pencil', instruction: `x tick ${t}`, from: { x: px, y: top + hPlot }, to: { x: px, y: top + hPlot + 1.5 }, layer: 'final' });
    builder.text({
      instruction: `x label ${t}`,
      at: { x: px, y: top + hPlot + 6 },
      text: opts.xLog ? `10^${t}` : fmtNum(t),
      align: 'middle',
      fontSize: 3.5,
    });
    if (opts.gridDecades && opts.xLog) {
      builder.line({ tool: '2H Pencil', instruction: 'grid', from: { x: px, y: top }, to: { x: px, y: top + hPlot }, layer: 'construction' });
    }
  }
  const yTicks = opts.yLog ? niceTicksLog(yMin, yMax) : niceTicksLinear(yMin, yMax, 5);
  for (const t of yTicks) {
    const py = top + hPlot - ((t - yMin) / (yMax - yMin || 1)) * hPlot;
    builder.line({ tool: 'HB Pencil', instruction: `y tick ${t}`, from: { x: left - 1.5, y: py }, to: { x: left, y: py }, layer: 'final' });
    builder.text({
      instruction: `y label ${t}`,
      at: { x: left - 3, y: py + 1 },
      text: opts.yLog ? `10^${t}` : fmtNum(t),
      align: 'end',
      baseline: 'middle',
      fontSize: 3.5,
    });
  }
  builder.text({
    instruction: 'X axis label',
    at: { x: left + wPlot / 2, y: top + hPlot + 12 },
    text: opts.xLabel,
    align: 'middle',
    fontSize: 4.5,
  });
  builder.text({
    instruction: 'Y axis label',
    at: { x: left - 14, y: top + hPlot / 2 },
    text: opts.yLabel,
    align: 'middle',
    baseline: 'middle',
    fontSize: 4.5,
  });

  // vlines / hlines
  for (const v of opts.vlines ?? []) {
    let xv = v.x;
    if (opts.xLog) xv = Math.log10(Math.max(v.x, 1e-12));
    if (xv < xMin || xv > xMax) continue;
    const px = left + ((xv - xMin) / (xMax - xMin || 1)) * wPlot;
    builder.line({ tool: '2H Pencil', instruction: `vline ${v.label ?? ''}`, from: { x: px, y: top }, to: { x: px, y: top + hPlot }, layer: 'construction' });
    if (v.label) builder.text({ instruction: 'vline label', at: { x: px + 1, y: top + 5 }, text: v.label, fontSize: 3.5 });
  }
  for (const h of opts.hlines ?? []) {
    let yv = h.y;
    if (opts.yLog) yv = Math.log10(Math.max(h.y, 1e-12));
    if (yv < yMin || yv > yMax) continue;
    const py = top + hPlot - ((yv - yMin) / (yMax - yMin || 1)) * hPlot;
    builder.line({ tool: '2H Pencil', instruction: `hline ${h.label ?? ''}`, from: { x: left, y: py }, to: { x: left + wPlot, y: py }, layer: 'construction' });
    if (h.label) builder.text({ instruction: 'hline label', at: { x: left + 2, y: py - 1 }, text: h.label, fontSize: 3.5 });
  }

  // series — break into segments at NaN/Inf
  for (const s of opts.series) {
    const pts: Pt[] = [];
    for (let i = 0; i < s.xs.length; i++) {
      let xv = s.xs[i];
      let yv = s.ys[i];
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) {
        if (pts.length >= 2) builder.curve({ tool: 'HB Pencil', instruction: s.label ?? 'series', points: pts.slice(), layer: 'final' });
        pts.length = 0;
        continue;
      }
      if (opts.xLog) xv = Math.log10(Math.max(s.xs[i], 1e-12));
      if (opts.yLog) yv = Math.log10(Math.max(s.ys[i], 1e-12));
      const px = left + ((xv - xMin) / (xMax - xMin || 1)) * wPlot;
      const py = top + hPlot - ((yv - yMin) / (yMax - yMin || 1)) * hPlot;
      pts.push({ x: px, y: py });
    }
    if (pts.length >= 2) builder.curve({ tool: 'HB Pencil', instruction: s.label ?? 'series', points: pts.slice(), layer: 'final' });
  }
  // legend
  if (opts.series.length > 1) {
    let yLeg = top + 4;
    for (const s of opts.series) {
      builder.text({ instruction: 'legend', at: { x: left + wPlot - 30, y: yLeg }, text: '— ' + (s.label ?? ''), fontSize: 3.8 });
      yLeg += 5;
    }
  }
  return (hPlot + 22) + (opts.title ? 9 : 0);
}

/* ============================================================ */
/* Polar Plot                                                    */
/* ============================================================ */

function renderPolar(builder: StrokeBuilder, opts: {
  title?: string; points: { re: number; im: number; omega?: number }[];
  annotateOmegas?: number[]; includeUnitCircle?: boolean; includeMinusOne?: boolean;
}, box: Box): number {
  let y = box.y;
  if (opts.title) {
    builder.text({ instruction: 'Polar title', at: { x: box.x + box.width / 2, y: y + 5 }, text: opts.title, fontSize: 5.5, align: 'middle' });
    y += 9;
  }
  const sz = Math.min(box.width, box.height - 12) - 10;
  const cx = box.x + box.width / 2;
  const cy = y + sz / 2 + 4;

  // determine scale
  let r = 1;
  for (const p of opts.points) {
    const m = Math.hypot(p.re, p.im);
    if (Number.isFinite(m) && m > r) r = m;
  }
  if (opts.includeMinusOne && r < 1.5) r = 1.5;
  const unit = (sz / 2) / r;

  // axes
  builder.line({ tool: 'T-Square', instruction: 'Re axis', from: { x: cx - sz / 2, y: cy }, to: { x: cx + sz / 2, y: cy }, layer: 'final' });
  builder.line({ tool: 'Set Square', instruction: 'Im axis', from: { x: cx, y: cy + sz / 2 }, to: { x: cx, y: cy - sz / 2 }, layer: 'final' });
  builder.text({ instruction: 'Re label', at: { x: cx + sz / 2 + 2, y: cy + 1 }, text: 'Re', baseline: 'middle', fontSize: 4 });
  builder.text({ instruction: 'Im label', at: { x: cx, y: cy - sz / 2 - 2 }, text: 'Im', align: 'middle', fontSize: 4 });

  // unit circle
  if (opts.includeUnitCircle) {
    builder.circle({ tool: '2H Pencil', instruction: 'unit circle', center: { x: cx, y: cy }, radius: unit, layer: 'construction' });
  }
  if (opts.includeMinusOne) {
    builder.line({ tool: 'HB Pencil', instruction: '-1 mark (1)', from: { x: cx - unit - 1.5, y: cy - 1.5 }, to: { x: cx - unit + 1.5, y: cy + 1.5 }, layer: 'final' });
    builder.line({ tool: 'HB Pencil', instruction: '-1 mark (2)', from: { x: cx - unit - 1.5, y: cy + 1.5 }, to: { x: cx - unit + 1.5, y: cy - 1.5 }, layer: 'final' });
    builder.text({ instruction: '-1 label', at: { x: cx - unit, y: cy + 5 }, text: '-1', align: 'middle', fontSize: 3.5 });
  }

  // curve (positive branch)
  const pts: Pt[] = opts.points
    .filter((p) => Number.isFinite(p.re) && Number.isFinite(p.im))
    .map((p) => ({ x: cx + p.re * unit, y: cy - p.im * unit }));
  if (pts.length >= 2) builder.curve({ tool: 'HB Pencil', instruction: 'Polar/Nyquist curve (ω > 0)', points: pts, layer: 'final' });

  // mirrored branch
  const ptsNeg: Pt[] = opts.points
    .filter((p) => Number.isFinite(p.re) && Number.isFinite(p.im))
    .map((p) => ({ x: cx + p.re * unit, y: cy + p.im * unit }));
  if (ptsNeg.length >= 2) builder.curve({ tool: '2H Pencil', instruction: 'Mirror curve (ω < 0)', points: ptsNeg, layer: 'construction' });

  // annotated frequencies
  if (opts.annotateOmegas && opts.points.length > 0) {
    for (const om of opts.annotateOmegas) {
      // find nearest sample
      let nearest = 0;
      let nd = Infinity;
      for (let i = 0; i < opts.points.length; i++) {
        const d = Math.abs((opts.points[i].omega ?? 0) - om);
        if (d < nd) { nd = d; nearest = i; }
      }
      const p = opts.points[nearest];
      const px = cx + p.re * unit;
      const py = cy - p.im * unit;
      builder.circle({ tool: 'Compass', instruction: `ω=${om}`, center: { x: px, y: py }, radius: 1, layer: 'final' });
      builder.text({ instruction: `ω=${om} label`, at: { x: px + 2, y: py - 2 }, text: `ω=${fmtNum(om)}`, fontSize: 3.5 });
    }
  }
  return sz + 12 + (opts.title ? 9 : 0);
}

/* ============================================================ */
/* Block Diagram                                                 */
/* ============================================================ */

function renderBlockDiagram(builder: StrokeBuilder, opts: { title?: string; diagram: BlockDiagram }, box: Box): number {
  let y = box.y;
  if (opts.title) {
    builder.text({ instruction: 'Block diagram title', at: { x: box.x + box.width / 2, y: y + 5 }, text: opts.title, fontSize: 5.5, align: 'middle' });
    y += 9;
  }

  const { blocks, edges } = opts.diagram;

  // Identify "forward" edges (acyclic skeleton): ignore edges that create back-edges
  // by treating any edge to a block already in the BFS frontier as a feedback link.
  // Two-pass layout: first, levels via Kahn-style topological sort over forward edges.
  // For nodes never reached (because of cycles), assign them sequentially after.
  const incomingFwd = new Map<string, number>();
  const adjFwd = new Map<string, string[]>();
  blocks.forEach((b) => incomingFwd.set(b.id, 0));
  const seenEdge = new Set<string>();
  const sourceCandidates = new Set<string>(blocks.filter((b) => b.kind === 'input').map((b) => b.id));
  if (sourceCandidates.size === 0) {
    // pick blocks with no incoming as sources
    for (const b of blocks) {
      if (!edges.some((e) => e.to === b.id)) sourceCandidates.add(b.id);
    }
  }
  // BFS from sources to mark forward edges
  const reachableOrder: string[] = [];
  {
    const visited = new Set<string>();
    const queue = [...sourceCandidates];
    sourceCandidates.forEach((s) => visited.add(s));
    while (queue.length) {
      const cur = queue.shift()!;
      reachableOrder.push(cur);
      for (const e of edges) {
        if (e.from !== cur) continue;
        const key = `${e.from}->${e.to}`;
        if (seenEdge.has(key)) continue;
        if (visited.has(e.to)) continue;
        seenEdge.add(key);
        let l = adjFwd.get(cur); if (!l) { l = []; adjFwd.set(cur, l); }
        l.push(e.to);
        incomingFwd.set(e.to, (incomingFwd.get(e.to) ?? 0) + 1);
        visited.add(e.to);
        queue.push(e.to);
      }
    }
  }
  // Kahn's algorithm on the forward subgraph to compute levels
  const level = new Map<string, number>();
  {
    const q: string[] = [];
    for (const id of reachableOrder) {
      if ((incomingFwd.get(id) ?? 0) === 0) { level.set(id, 0); q.push(id); }
    }
    while (q.length) {
      const cur = q.shift()!;
      const lvl = level.get(cur)!;
      for (const next of adjFwd.get(cur) ?? []) {
        const nl = (level.get(next) ?? 0);
        if (lvl + 1 > nl) level.set(next, lvl + 1);
        incomingFwd.set(next, (incomingFwd.get(next) ?? 0) - 1);
        if ((incomingFwd.get(next) ?? 0) === 0) q.push(next);
      }
    }
  }
  // Any block missed (rare — disconnected) gets level 0
  for (const b of blocks) if (!level.has(b.id)) level.set(b.id, 0);
  // Compute per-level rows
  const byLevel = new Map<number, string[]>();
  for (const b of blocks) {
    const l = level.get(b.id) ?? 0;
    let list = byLevel.get(l);
    if (!list) { list = []; byLevel.set(l, list); }
    list.push(b.id);
  }
  const maxLevel = Math.max(...byLevel.keys());
  const widthPerLevel = box.width / (maxLevel + 2);
  const blockW = 26;
  const blockH = 12;

  const positions = new Map<string, Pt>();
  for (const [l, list] of byLevel) {
    const x = box.x + widthPerLevel * (l + 1);
    for (let i = 0; i < list.length; i++) {
      const yc = y + 22 + i * 22;
      positions.set(list[i], { x, y: yc });
    }
  }

  // draw blocks
  for (const b of blocks) {
    const p = positions.get(b.id)!;
    if (b.kind === 'tf' || b.kind === 'gain') {
      // box
      const corners: [Pt, Pt, Pt, Pt] = [
        { x: p.x - blockW / 2, y: p.y - blockH / 2 },
        { x: p.x + blockW / 2, y: p.y - blockH / 2 },
        { x: p.x + blockW / 2, y: p.y + blockH / 2 },
        { x: p.x - blockW / 2, y: p.y + blockH / 2 },
      ];
      for (let i = 0; i < 4; i++) {
        builder.line({ tool: 'T-Square', instruction: `block ${b.id} side ${i}`, from: corners[i], to: corners[(i + 1) % 4], layer: 'final' });
      }
      builder.text({
        instruction: `block ${b.id} label`,
        at: { x: p.x, y: p.y + 1 },
        text: b.expr ?? b.label ?? b.id,
        align: 'middle',
        baseline: 'middle',
        fontSize: 4,
      });
    } else if (b.kind === 'sum') {
      builder.circle({ tool: 'Compass', instruction: `sum ${b.id}`, center: p, radius: 4, layer: 'final' });
      builder.line({ tool: 'HB Pencil', instruction: 'sum +', from: { x: p.x - 4, y: p.y }, to: { x: p.x + 4, y: p.y }, layer: 'final' });
      builder.line({ tool: 'HB Pencil', instruction: 'sum +', from: { x: p.x, y: p.y - 4 }, to: { x: p.x, y: p.y + 4 }, layer: 'final' });
      // sign labels
      const signs = b.signs ?? [];
      const incoming = edges.filter((e) => e.to === b.id);
      for (let i = 0; i < incoming.length; i++) {
        const s = signs[i] ?? '+';
        const eFrom = positions.get(incoming[i].from);
        if (!eFrom) continue;
        const mx = (eFrom.x + p.x) / 2;
        const my = (eFrom.y + p.y) / 2;
        builder.text({ instruction: `sum sign ${s}`, at: { x: mx, y: my - 2 }, text: s, fontSize: 4 });
      }
    } else if (b.kind === 'input' || b.kind === 'output') {
      builder.text({
        instruction: `${b.kind} label`,
        at: { x: p.x, y: p.y + 1 },
        text: b.label ?? (b.kind === 'input' ? 'R(s)' : 'C(s)'),
        align: 'middle',
        baseline: 'middle',
        fontSize: 4.5,
      });
    } else if (b.kind === 'pickoff') {
      builder.circle({ tool: 'Compass', instruction: 'pickoff', center: p, radius: 1.2, layer: 'final' });
    }
  }
  // draw edges
  for (const e of edges) {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) continue;
    // Offset from box edges
    const fromBlock = blocks.find((bl) => bl.id === e.from);
    const toBlock = blocks.find((bl) => bl.id === e.to);
    const offA: Pt = { x: a.x + (fromBlock?.kind === 'tf' || fromBlock?.kind === 'gain' ? blockW / 2 : 4), y: a.y };
    const offB: Pt = { x: b.x - (toBlock?.kind === 'tf' || toBlock?.kind === 'gain' ? blockW / 2 : 4), y: b.y };
    if (Math.abs(offA.y - offB.y) < 2) {
      builder.arrow({ tool: 'HB Pencil', instruction: `edge ${e.from}→${e.to}`, from: offA, to: offB, layer: 'final' });
    } else {
      // L-shaped wire: right, down, right (or mirrored)
      const mid = { x: (offA.x + offB.x) / 2, y: offA.y };
      const mid2 = { x: mid.x, y: offB.y };
      builder.line({ tool: 'HB Pencil', instruction: 'wire seg 1', from: offA, to: mid, layer: 'final' });
      builder.line({ tool: 'HB Pencil', instruction: 'wire seg 2', from: mid, to: mid2, layer: 'final' });
      builder.arrow({ tool: 'HB Pencil', instruction: 'wire seg 3', from: mid2, to: offB, layer: 'final' });
    }
  }
  // estimate height
  const maxRow = Math.max(...[...byLevel.values()].map((l) => l.length));
  return 22 + maxRow * 22 + (opts.title ? 9 : 0);
}

/* ============================================================ */
/* Signal Flow Graph                                             */
/* ============================================================ */

function renderSFG(builder: StrokeBuilder, opts: { title?: string; graph: SignalFlowGraph }, box: Box): number {
  let y = box.y;
  if (opts.title) {
    builder.text({ instruction: 'SFG title', at: { x: box.x + box.width / 2, y: y + 5 }, text: opts.title, fontSize: 5.5, align: 'middle' });
    y += 9;
  }
  const { nodes, branches } = opts.graph;
  // place nodes in a line; loop edges drawn as arcs above
  const n = nodes.length;
  const pad = 30;
  const dx = (box.width - 2 * pad) / Math.max(n - 1, 1);
  const yc = y + 25;
  const positions = new Map<string, Pt>();
  nodes.forEach((node, i) => {
    positions.set(node.id, { x: box.x + pad + i * dx, y: yc });
  });
  // dots
  for (const node of nodes) {
    const p = positions.get(node.id)!;
    builder.circle({ tool: 'Compass', instruction: `node ${node.id}`, center: p, radius: 1.4, layer: 'final' });
    builder.text({ instruction: 'node label', at: { x: p.x, y: p.y - 4 }, text: node.label ?? node.id, align: 'middle', fontSize: 4 });
  }
  // branches
  for (const br of branches) {
    const a = positions.get(br.from);
    const b = positions.get(br.to);
    if (!a || !b) continue;
    if (br.from === br.to) {
      const cx = a.x;
      const cy = a.y - 12;
      builder.arc({
        tool: 'HB Pencil',
        instruction: `self-loop ${br.from}: ${br.gain}`,
        center: { x: cx, y: cy },
        radius: 8,
        startAngle: Math.PI * 0.2,
        endAngle: Math.PI * 0.8,
        anticlockwise: true,
        layer: 'final',
      });
      builder.text({ instruction: 'self-loop gain', at: { x: cx, y: cy - 8 }, text: br.gain, align: 'middle', fontSize: 3.5 });
      continue;
    }
    // arrow with arc to disambiguate
    const dxx = b.x - a.x;
    const sameDir = dxx > 0;
    if (sameDir) {
      builder.arrow({ tool: 'HB Pencil', instruction: `${br.from}→${br.to}: ${br.gain}`, from: a, to: b, layer: 'final' });
      builder.text({ instruction: 'branch gain', at: { x: (a.x + b.x) / 2, y: a.y - 3 }, text: br.gain, align: 'middle', fontSize: 3.5 });
    } else {
      // backward — curve below the line
      const ctrl: Pt = { x: (a.x + b.x) / 2, y: a.y + 14 };
      builder.curve({
        tool: 'HB Pencil',
        instruction: `back ${br.from}→${br.to}: ${br.gain}`,
        points: [a, ctrl, b],
        layer: 'final',
      });
      builder.text({ instruction: 'branch gain', at: { x: ctrl.x, y: ctrl.y + 3 }, text: br.gain, align: 'middle', fontSize: 3.5 });
    }
  }
  return 45 + (opts.title ? 9 : 0);
}

/* ============================================================ */
/* Master                                                        */
/* ============================================================ */

function sectionHeight(section: ControlSection): number {
  switch (section.kind) {
    case 'text':
      return (section.title ? 8 : 0) + Math.max(1, section.lines.length) * 5 + 6;
    case 'equation':
      return (section.title ? 8 : 0) + Math.max(1, section.lines.length) * 7 + 6;
    case 'matrix': {
      const rows = section.data.length;
      return (section.title ? 8 : 0) + Math.max(1, rows) * 7 + 8;
    }
    case 'table':
      return (section.title ? 8 : 0) + (section.rows.length + 1) * 7 + 6;
    case 'pole-zero':
      return (section.title ? 8 : 0) + 90;
    case 'xy-plot':
      return (section.title ? 9 : 0) + 100;
    case 'polar':
      return (section.title ? 9 : 0) + 110;
    case 'block-diagram': {
      // approximate height: assume single-row layout, scale with block count
      const blockCount = section.diagram.blocks.length;
      const rows = Math.max(1, Math.ceil(blockCount / 4));
      return 22 + rows * 22 + (section.title ? 9 : 0);
    }
    case 'sfg':
      return 50 + (section.title ? 9 : 0);
  }
}

export function renderControlDoc(doc: ControlDoc): { strokes: Stroke[]; paperWidthMm: number; paperHeightMm: number } {
  const paperWidth = 420;
  const hasTitle = doc.title.trim().length > 0;
  const hasSummary = doc.summary.trim().length > 0;
  const titleH = hasTitle ? 12 : 0;
  const summaryLines = hasSummary ? wrapText(doc.summary, 100) : [];
  const summaryH = hasSummary ? Math.max(8, summaryLines.length * 5) : 0;
  const sectionsH = doc.sections.reduce((a, s) => a + sectionHeight(s) + 6, 0);
  const totalH = Math.max(297, titleH + summaryH + sectionsH + 30);
  const paperHeight = totalH > 297 ? Math.min(2000, totalH + 10) : 297;

  const builder = new StrokeBuilder();
  if (hasTitle) {
    builder.text({
      instruction: 'Document title',
      at: { x: paperWidth / 2, y: 14 },
      text: doc.title,
      align: 'middle',
      fontSize: 7,
    });
  }
  let y = hasTitle ? 22 : 12;
  for (const line of summaryLines) {
    builder.text({ instruction: 'Summary', at: { x: paperWidth / 2, y }, text: line, align: 'middle', fontSize: 4 });
    y += 5;
  }
  if (hasSummary) y += 6;

  for (const section of doc.sections) {
    const h = sectionHeight(section);
    const box: Box = { x: 10, y, width: paperWidth - 20, height: h };
    switch (section.kind) {
      case 'text': renderText(builder, section, box); break;
      case 'equation': renderEquation(builder, section, box); break;
      case 'matrix': renderMatrix(builder, section, box); break;
      case 'table': renderTable(builder, section, box); break;
      case 'pole-zero': renderPoleZero(builder, section, box); break;
      case 'xy-plot': renderXY(builder, section, box); break;
      case 'polar': renderPolar(builder, section, box); break;
      case 'block-diagram': renderBlockDiagram(builder, section, box); break;
      case 'sfg': renderSFG(builder, section, box); break;
    }
    y += h + 6;
  }
  return { strokes: builder.build(), paperWidthMm: paperWidth, paperHeightMm: paperHeight };
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
