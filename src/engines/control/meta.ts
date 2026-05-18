import type {
  ControlMasonMeta,
  ControlMasonPathMeta,
  ControlMeta,
  ControlPlotKind,
  ControlPlotRef,
  ControlReductionStepMeta,
  ControlRouthMeta,
  ControlStabilityMeta,
  ControlTfMeta,
  WorkspaceContentBlock,
} from '@/engines/types';
import { polyToString } from './polynomial';
import { getPoles, getZeros, type TransferFunction } from './transferFunction';
import type { ControlDoc, ControlSection } from './controlTypes';
import type { ControlTopic } from './parser';

const DIAGRAM_KINDS = new Set<ControlSection['kind']>([
  'pole-zero',
  'xy-plot',
  'polar',
  'block-diagram',
  'sfg',
]);

export function isControlDiagramSection(s: ControlSection): boolean {
  return DIAGRAM_KINDS.has(s.kind);
}

/**
 * Extract a JSON-safe ControlMeta from the engine's ControlDoc + parsed
 * inputs. The base canvas never reads this; the Control workspace module
 * does, to render system info, TF, stability, reduction, and a plot list.
 */
export function controlMetaFromDoc(
  doc: ControlDoc,
  topic: ControlTopic,
  tf?: TransferFunction
): ControlMeta {
  const meta: ControlMeta = { kind: 'control', topic };

  if (tf) meta.tf = tfToMeta(tf);
  if (meta.tf) meta.stability = stabilityFromPoles(meta.tf);

  const consumed = new Set<ControlSection>();
  for (const sec of doc.sections) {
    handleSection(sec, meta, consumed);
  }

  meta.headline = { title: doc.title, summary: doc.summary };
  const content = collectContent(doc.sections, consumed, meta);
  if (content.length) meta.content = content;

  return meta;
}

function collectContent(
  sections: ControlSection[],
  consumed: Set<ControlSection>,
  meta: ControlMeta
): WorkspaceContentBlock[] {
  const out: WorkspaceContentBlock[] = [];
  const tfDisplay = meta.tf?.display;
  for (const sec of sections) {
    if (consumed.has(sec)) continue;
    if (isControlDiagramSection(sec)) continue;
    switch (sec.kind) {
      case 'text':
        out.push({
          kind: 'text',
          title: sec.title,
          lines: sec.lines,
          mono: sec.mono,
        });
        break;
      case 'equation': {
        // Skip the headline "Transfer function" equation — already shown
        // structurally in the TF panel.
        const t = (sec.title ?? '').toLowerCase();
        const matchesTf =
          t.includes('transfer function') ||
          (tfDisplay && sec.lines.some((l) => l.includes(tfDisplay)));
        if (matchesTf && (t === 'transfer function' || t === 'source tf' || t === 'open-loop')) {
          // Still surface if it's an output of a derivation step; default skip.
          continue;
        }
        out.push({
          kind: 'equation',
          title: sec.title,
          lines: sec.lines,
        });
        break;
      }
      case 'matrix':
        out.push({
          kind: 'matrix',
          title: sec.title,
          name: sec.name,
          data: sec.data,
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
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */

function tfToMeta(tf: TransferFunction): ControlTfMeta {
  const poles = getPoles(tf).map((p) => ({ re: p.re, im: p.im }));
  const zeros = getZeros(tf).map((z) => ({ re: z.re, im: z.im }));
  const systemType = poles.filter(
    (p) => Math.abs(p.re) < 1e-9 && Math.abs(p.im) < 1e-9
  ).length;
  return {
    display:
      tf.display ||
      `(${polyToString(tf.numerator)})/(${polyToString(tf.denominator)})`,
    numerator: tf.numerator.slice(),
    denominator: tf.denominator.slice(),
    poles,
    zeros,
    order: Math.max(0, tf.denominator.length - 1),
    systemType,
  };
}

function stabilityFromPoles(tf: ControlTfMeta): ControlStabilityMeta {
  const rhp = tf.poles.filter((p) => p.re > 1e-9).length;
  return { stable: rhp === 0, rhpPoles: rhp };
}

/* ------------------------------------------------------------------ */

function handleSection(
  sec: ControlSection,
  meta: ControlMeta,
  consumed: Set<ControlSection>
): void {
  if (sec.kind === 'table') {
    const title = sec.title?.toLowerCase() ?? '';
    if (title.includes('routh array')) {
      meta.routh = { headers: sec.headers, rows: sec.rows } satisfies ControlRouthMeta;
      consumed.add(sec);
      return;
    }
    if (title.includes('stability margin') || title === 'result' || sec.headers.length === 2) {
      const merged = mergeMargins(sec, meta);
      if (merged) consumed.add(sec);
    }
    if (title === 'forward paths') {
      const forwardPaths: ControlMasonPathMeta[] = sec.rows.map((r) => ({
        label: r[0] ?? '',
        path: r[1] ?? '',
        gain: r[2] ?? '',
      }));
      mergeMason(meta, { forwardPaths });
      consumed.add(sec);
      return;
    }
    if (title === 'loops') {
      const loops: ControlMasonPathMeta[] = sec.rows.map((r) => ({
        label: r[0] ?? '',
        path: r[1] ?? '',
        gain: r[2] ?? '',
      }));
      mergeMason(meta, { loops });
      consumed.add(sec);
      return;
    }
    return;
  }
  if (sec.kind === 'equation') {
    if ((sec.title ?? '').toLowerCase().includes("mason's gain")) {
      const transferFunction = sec.lines[sec.lines.length - 1] ?? '';
      mergeMason(meta, { transferFunction });
      consumed.add(sec);
    }
    return;
  }
  if (sec.kind === 'text') {
    if ((sec.title ?? '').toLowerCase() === 'step') {
      const step: ControlReductionStepMeta = {
        description: sec.lines.join(' ').trim(),
      };
      meta.reduction = [...(meta.reduction ?? []), step];
      consumed.add(sec);
    }
    return;
  }
  if (
    sec.kind === 'xy-plot' ||
    sec.kind === 'pole-zero' ||
    sec.kind === 'polar' ||
    sec.kind === 'block-diagram' ||
    sec.kind === 'sfg'
  ) {
    const ref: ControlPlotRef = {
      title: sec.title ?? sec.kind,
      kind: plotKind(sec),
    };
    meta.plots = [...(meta.plots ?? []), ref];
  }
}

/* ------------------------------------------------------------------ */

function mergeMargins(
  sec: Extract<ControlSection, { kind: 'table' }>,
  meta: ControlMeta
): boolean {
  const next: Partial<ControlStabilityMeta> = {};
  for (const row of sec.rows) {
    const key = (row[0] ?? '').toLowerCase();
    const val = row[1] ?? '';
    const omega = row[2];
    if (key.includes('gain margin')) {
      next.gainMarginDb = parseLooseNumber(val);
      if (omega) next.wcp = parseLooseNumber(omega);
    } else if (key.includes('phase margin')) {
      next.phaseMarginDeg = parseLooseNumber(val);
      if (omega) next.wcg = parseLooseNumber(omega);
    } else if (key.includes('closed-loop rhp poles')) {
      const v = parseLooseNumber(val);
      if (v !== null) next.rhpPoles = v;
    } else if (key === 'stability') {
      next.stable = /^stable/i.test(val);
    }
  }
  if (Object.keys(next).length === 0) return false;
  meta.stability = {
    stable: meta.stability?.stable ?? false,
    ...meta.stability,
    ...next,
  };
  return true;
}

/** Parse "8.2 dB", "47°", "∞", "—", numeric strings. Returns null on N/A. */
function parseLooseNumber(s: string): number | null {
  const t = s.trim();
  if (t === '' || t === '—' || t === '-' || /^undefined$/i.test(t)) return null;
  if (t === '∞') return Infinity;
  const m = t.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) ? v : null;
}

/* ------------------------------------------------------------------ */

function mergeMason(meta: ControlMeta, patch: Partial<ControlMasonMeta>): void {
  meta.mason = {
    forwardPaths: meta.mason?.forwardPaths ?? [],
    loops: meta.mason?.loops ?? [],
    transferFunction: meta.mason?.transferFunction ?? '',
    ...patch,
  };
}

/* ------------------------------------------------------------------ */

function plotKind(sec: ControlSection): ControlPlotKind {
  if (sec.kind === 'pole-zero') return 'pole-zero';
  if (sec.kind === 'polar') return 'polar';
  if (sec.kind === 'block-diagram') return 'block-diagram';
  if (sec.kind === 'sfg') return 'signal-flow-graph';
  if (sec.kind === 'xy-plot') {
    const t = (sec.title ?? '').toLowerCase();
    if (t.includes('magnitude')) return 'bode-magnitude';
    if (t.includes('phase')) return 'bode-phase';
    if (t.includes('root locus')) return 'root-locus';
    if (
      t.includes('response') ||
      t.includes('step') ||
      t.includes('impulse') ||
      t.includes('ramp')
    )
      return 'time-response';
    return 'other';
  }
  return 'other';
}
