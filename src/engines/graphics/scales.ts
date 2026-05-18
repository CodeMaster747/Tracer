import type { Stroke, PaperSpec, Pt } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { StrokeBuilder } from '@/engines/shared/strokeBuilder';
import { drawTitle, xyLineY, pageCenterX } from './layout';
import { fmt } from './geometry';

export type ScaleKind = 'plain' | 'diagonal' | 'vernier' | 'comparative';

export interface ScaleSpec {
  kind: ScaleKind;
  /** Representative fraction, e.g. 1/100 means RF = 0.01.  */
  rf: number;
  /** Largest length the scale should read in the units of the LARGEST main division. */
  maxValue: number;
  /** Name of the main unit (e.g. "metre"). */
  mainUnit: string;
  /** Name of the secondary unit (sub-division), e.g. "dm" for decimetre. */
  subUnit?: string;
  /** For diagonal: 'tertiary' is the third subdivision unit name (e.g. "cm"). */
  tertiaryUnit?: string;
  /** For vernier scales: backward (true) or forward (false). */
  backwardVernier?: boolean;
  /** For comparative scales: name and conversion factor (sub-unit per main unit). */
  secondaryUnit?: string;
  secondaryConversion?: number; // e.g. miles to km = 1.609
}

interface ScaleResult {
  strokes: Stroke[];
  paper: PaperSpec;
  summary: string;
}

/**
 * Build a metric drawing of a scale.
 *  - Length on paper of a value `v` (in main units) = RF · v · 1000  (mm per metre)
 *  - We assume the user wants the largest value the scale must read.
 *  - The scale length is RF × maxValue × (mm per main unit). For a representative fraction
 *    1/100 and a max of 5 metres, that's (1/100) × 5 × 1000 = 50mm. That's too small to be
 *    readable, so we multiply by an internal factor of `paperScale` to make the drawing
 *    legible while still labelling values truthfully.
 */
export function buildScale(spec: ScaleSpec): ScaleResult {
  const paper = paperSpec('A3', 'landscape');
  const builder = new StrokeBuilder();
  drawTitle(builder, titleFor(spec));

  switch (spec.kind) {
    case 'plain':
      return plainScale(spec, builder, paper);
    case 'diagonal':
      return diagonalScale(spec, builder, paper);
    case 'vernier':
      return vernierScale(spec, builder, paper);
    case 'comparative':
      return comparativeScale(spec, builder, paper);
  }
}

/* ----- Plain scale: main divisions + 10 subdivisions in the first cell ----- */

function plainScale(
  spec: ScaleSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): ScaleResult {
  const mmPerMainUnit = paperLengthOf(spec, 1);
  const lengthMm = mmPerMainUnit * spec.maxValue;
  const startX = pageCenterX() - lengthMm / 2;
  const baseY = xyLineY();
  const scaleH = 10;

  drawScaleBox(builder, startX, baseY, lengthMm, scaleH);

  // Main divisions (0..maxValue), with first cell on the LEFT of zero containing subdivisions
  for (let i = 0; i <= spec.maxValue; i++) {
    const x = startX + i * mmPerMainUnit;
    builder.line({
      tool: 'HB Pencil',
      instruction: `Main division at ${i} ${spec.mainUnit}`,
      from: { x, y: baseY },
      to: { x, y: baseY + scaleH },
      layer: 'final',
    });
    // Label numbers
    if (i > 0) {
      builder.text({
        instruction: `Main division label ${i}`,
        at: { x, y: baseY + scaleH + 5 },
        text: `${i - 1}`,
        align: 'middle',
        fontSize: 4,
      });
    }
  }

  // Subdivisions in the FIRST cell (between 0 and -1 mainUnit shown as 10 sub-units)
  const subCount = 10;
  for (let i = 0; i <= subCount; i++) {
    const x = startX + (mmPerMainUnit * i) / subCount;
    builder.line({
      tool: '2H Pencil',
      instruction: `Sub-division ${i}/${subCount}`,
      from: { x, y: baseY },
      to: { x, y: baseY + scaleH * 0.6 },
      layer: 'final',
    });
    if (i % 2 === 0) {
      builder.text({
        instruction: 'Sub-division label',
        at: { x, y: baseY - 2 },
        text: `${subCount - i}`,
        align: 'middle',
        fontSize: 3,
      });
    }
  }

  // RF + units labels
  builder.text({
    instruction: 'RF label',
    at: { x: pageCenterX(), y: baseY + 25 },
    text: `R.F. = ${rfStr(spec.rf)}`,
    align: 'middle',
    fontSize: 5,
  });
  builder.text({
    instruction: 'Unit label',
    at: { x: startX - mmPerMainUnit / 2, y: baseY - 8 },
    text: spec.subUnit ?? 'sub-units',
    align: 'middle',
    fontSize: 3.5,
  });
  builder.text({
    instruction: 'Main-unit label',
    at: { x: startX + lengthMm / 2, y: baseY + scaleH + 12 },
    text: spec.mainUnit,
    align: 'middle',
    fontSize: 3.5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Plain scale of R.F. ${rfStr(
      spec.rf
    )} reading up to ${spec.maxValue} ${spec.mainUnit} and ${spec.subUnit ?? 'sub-units'}. The total paper length is R.F. × ${
      spec.maxValue
    } × (mm per ${spec.mainUnit}) = ${fmt(lengthMm)}mm. The first cell on the left is divided into 10 sub-divisions so the scale can read directly down to one sub-unit.`,
  };
}

/* ----- Diagonal scale: adds a vertical 10×10 grid on the left cell ----- */

function diagonalScale(
  spec: ScaleSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): ScaleResult {
  const mmPerMainUnit = paperLengthOf(spec, 1);
  const lengthMm = mmPerMainUnit * spec.maxValue;
  const startX = pageCenterX() - lengthMm / 2;
  const baseY = xyLineY() + 30;
  const scaleH = 30;

  drawScaleBox(builder, startX, baseY - scaleH, lengthMm, scaleH);

  // Horizontal lines (10 subdivisions of height)
  for (let i = 1; i < 10; i++) {
    builder.line({
      tool: '2H Pencil',
      instruction: `Horizontal sub-line ${i}/10`,
      from: { x: startX, y: baseY - (scaleH * i) / 10 },
      to: { x: startX + lengthMm, y: baseY - (scaleH * i) / 10 },
      layer: 'construction',
    });
  }

  // Main divisions
  for (let i = 0; i <= spec.maxValue; i++) {
    const x = startX + i * mmPerMainUnit;
    builder.line({
      tool: 'HB Pencil',
      instruction: `Main division at ${i}`,
      from: { x, y: baseY },
      to: { x, y: baseY - scaleH },
      layer: 'final',
    });
    if (i > 0) {
      builder.text({
        instruction: `Main division label ${i}`,
        at: { x, y: baseY + 6 },
        text: `${i - 1}`,
        align: 'middle',
        fontSize: 4,
      });
    }
  }

  // 10 sub-divisions on the top horizontal of the first cell
  for (let i = 0; i <= 10; i++) {
    const x = startX + (mmPerMainUnit * i) / 10;
    builder.line({
      tool: '2H Pencil',
      instruction: `Top sub-division ${i}/10`,
      from: { x, y: baseY - scaleH },
      to: { x, y: baseY - scaleH - 3 },
      layer: 'final',
    });
    if (i % 2 === 0) {
      builder.text({
        instruction: 'Sub label',
        at: { x, y: baseY - scaleH - 6 },
        text: `${10 - i}`,
        align: 'middle',
        fontSize: 3,
      });
    }
  }

  // Diagonal lines (the magic of the diagonal scale)
  for (let i = 1; i <= 10; i++) {
    const xTopBase = startX + (mmPerMainUnit * i) / 10;
    const xBottom = startX + (mmPerMainUnit * (i - 1)) / 10;
    builder.line({
      tool: 'HB Pencil',
      instruction: `Diagonal ${i}/10 in the first cell`,
      from: { x: xTopBase, y: baseY - scaleH },
      to: { x: xBottom, y: baseY },
      layer: 'final',
    });
  }

  builder.text({
    instruction: 'RF label',
    at: { x: pageCenterX(), y: baseY + 18 },
    text: `R.F. = ${rfStr(spec.rf)} — diagonal scale`,
    align: 'middle',
    fontSize: 5,
  });
  builder.text({
    instruction: 'Tertiary unit label',
    at: { x: startX - 6, y: baseY - scaleH / 2 },
    text: spec.tertiaryUnit ?? '1/10 sub-unit',
    align: 'end',
    fontSize: 3.5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Diagonal scale of R.F. ${rfStr(
      spec.rf
    )} reading ${spec.mainUnit}, ${spec.subUnit ?? 'sub-unit'} and ${
      spec.tertiaryUnit ?? '1/100 of main unit'
    }. The leftmost cell is divided into a 10×10 grid; the diagonals connect (i/10 on top) to ((i-1)/10 on bottom), so the intersection with the j-th horizontal gives a length equal to (i·j)/100 of one main unit. This lets the scale read down to one hundredth without an additional cursor.`,
  };
}

/* ----- Vernier scale: forward / backward ----- */

function vernierScale(
  spec: ScaleSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): ScaleResult {
  const mmPerMainUnit = paperLengthOf(spec, 1);
  const lengthMm = mmPerMainUnit * spec.maxValue;
  const startX = pageCenterX() - lengthMm / 2;
  const mainY = xyLineY() + 20;
  const scaleH = 10;
  const vernierH = 10;
  const backward = spec.backwardVernier ?? false;

  drawScaleBox(builder, startX, mainY - scaleH, lengthMm, scaleH);
  // Main scale divisions: each main unit divided into 10 sub-divisions
  for (let i = 0; i <= spec.maxValue * 10; i++) {
    const x = startX + (mmPerMainUnit * i) / 10;
    const tall = i % 10 === 0;
    builder.line({
      tool: tall ? 'HB Pencil' : '2H Pencil',
      instruction: tall
        ? `Main division at ${i / 10} ${spec.mainUnit}`
        : `Sub-division ${i % 10}/10`,
      from: { x, y: mainY - scaleH },
      to: { x, y: mainY },
      layer: 'final',
    });
    if (tall && i > 0) {
      builder.text({
        instruction: `Main label ${i / 10}`,
        at: { x, y: mainY + 5 },
        text: `${i / 10 - 1}`,
        align: 'middle',
        fontSize: 4,
      });
    }
  }

  // Vernier slider: width covering 9 (forward) or 11 (backward) main sub-divisions,
  // divided into 10 vernier divisions.
  const slider = backward ? 11 : 9;
  const sliderWidth = (mmPerMainUnit * slider) / 10;
  const sliderStart = startX + mmPerMainUnit; // place at the first whole main-unit
  drawScaleBox(builder, sliderStart, mainY, sliderWidth, vernierH);
  for (let i = 0; i <= 10; i++) {
    const x = sliderStart + (sliderWidth * i) / 10;
    builder.line({
      tool: 'HB Pencil',
      instruction: `Vernier division ${i}/10`,
      from: { x, y: mainY },
      to: { x, y: mainY + vernierH },
      layer: 'final',
    });
    builder.text({
      instruction: `Vernier label ${i}`,
      at: { x, y: mainY + vernierH + 4 },
      text: `${i}`,
      align: 'middle',
      fontSize: 3.5,
    });
  }

  builder.text({
    instruction: 'Type label',
    at: { x: pageCenterX(), y: mainY + vernierH + 14 },
    text: `${backward ? 'Backward' : 'Forward'} vernier — R.F. ${rfStr(spec.rf)}`,
    align: 'middle',
    fontSize: 5,
  });

  const ratio = backward ? 11 / 10 : 9 / 10;
  return {
    strokes: builder.build(),
    paper,
    summary: `${
      backward ? 'Backward' : 'Forward'
    } vernier scale of R.F. ${rfStr(
      spec.rf
    )}. Main scale has 10 sub-divisions per ${spec.mainUnit}. The vernier carriage covers ${
      backward ? 11 : 9
    } sub-divisions of the main scale and is divided into 10 vernier divisions, so 1 vernier division = ${
      backward ? '11/10' : '9/10'
    } of a main sub-division = ${fmt(
      ratio * (mmPerMainUnit / 10),
      3
    )}mm on the paper. The least count = 1 main sub-division − 1 vernier division = ${fmt(
      Math.abs(1 - ratio) * (mmPerMainUnit / 10),
      3
    )}mm in the drawing or, in the depicted unit, 1/100 of one ${spec.mainUnit}.`,
  };
}

/* ----- Comparative scale: two scales aligned at the same RF, different units ----- */

function comparativeScale(
  spec: ScaleSpec,
  builder: StrokeBuilder,
  paper: PaperSpec
): ScaleResult {
  const mmPerMainUnit = paperLengthOf(spec, 1);
  const lengthMm = mmPerMainUnit * spec.maxValue;
  const startX = pageCenterX() - lengthMm / 2;
  const topY = xyLineY() - 10;
  const botY = xyLineY() + 10;
  const scaleH = 10;

  drawScaleBox(builder, startX, topY - scaleH, lengthMm, scaleH);
  drawScaleBox(builder, startX, botY, lengthMm, scaleH);

  // Top scale (main unit)
  for (let i = 0; i <= spec.maxValue; i++) {
    const x = startX + i * mmPerMainUnit;
    builder.line({
      tool: 'HB Pencil',
      instruction: `Top division at ${i} ${spec.mainUnit}`,
      from: { x, y: topY },
      to: { x, y: topY - scaleH },
      layer: 'final',
    });
    builder.text({
      instruction: `Top label ${i}`,
      at: { x, y: topY - scaleH - 3 },
      text: `${i}`,
      align: 'middle',
      fontSize: 4,
    });
  }

  // Bottom scale (secondary unit) — convert with secondaryConversion (secondary per main)
  const conv = spec.secondaryConversion ?? 1.609;
  const totalSec = spec.maxValue * conv;
  const ticks = Math.ceil(totalSec);
  for (let i = 0; i <= ticks; i++) {
    const x = startX + (i / conv) * mmPerMainUnit;
    if (x > startX + lengthMm + 0.5) break;
    builder.line({
      tool: 'HB Pencil',
      instruction: `Bottom division at ${i} ${spec.secondaryUnit ?? 'secondary'}`,
      from: { x, y: botY },
      to: { x, y: botY + scaleH },
      layer: 'final',
    });
    builder.text({
      instruction: `Bottom label ${i}`,
      at: { x, y: botY + scaleH + 4 },
      text: `${i}`,
      align: 'middle',
      fontSize: 4,
    });
  }

  builder.text({
    instruction: 'Top unit',
    at: { x: startX - 10, y: topY - scaleH / 2 },
    text: spec.mainUnit,
    align: 'end',
    baseline: 'middle',
    fontSize: 3.5,
  });
  builder.text({
    instruction: 'Bottom unit',
    at: { x: startX - 10, y: botY + scaleH / 2 },
    text: spec.secondaryUnit ?? 'unit',
    align: 'end',
    baseline: 'middle',
    fontSize: 3.5,
  });
  builder.text({
    instruction: 'RF label',
    at: { x: pageCenterX(), y: botY + scaleH + 14 },
    text: `R.F. = ${rfStr(spec.rf)} — comparative scale (${spec.mainUnit} ↔ ${spec.secondaryUnit})`,
    align: 'middle',
    fontSize: 5,
  });

  return {
    strokes: builder.build(),
    paper,
    summary: `Comparative scale of R.F. ${rfStr(
      spec.rf
    )}. Top scale measures in ${spec.mainUnit}; bottom scale (aligned on the same RF) measures in ${
      spec.secondaryUnit
    } using the conversion 1 ${spec.mainUnit} = ${fmt(conv, 3)} ${spec.secondaryUnit}. To read any length: look up directly from the figure on the corresponding scale.`,
  };
}

/* ----- Helpers ----- */

function paperLengthOf(spec: ScaleSpec, valueInMainUnits: number): number {
  // Assume one "mainUnit" corresponds to a real-world distance whose value in mm depends on units.
  // For metric defaults (metre/dm/cm), 1 metre = 1000mm. For other units the caller can pass
  // an explicit `metresPerMainUnit` in a more advanced version. Here we accept that the user
  // implies the unit's name; we just convert with a sensible default for common units.
  const mPerUnit = mPerMainUnit(spec.mainUnit);
  return spec.rf * valueInMainUnits * mPerUnit * 1000;
}

function mPerMainUnit(name: string): number {
  const m = name.trim().toLowerCase();
  if (m === 'm' || m.startsWith('metre') || m.startsWith('meter')) return 1;
  if (m === 'dm' || m.startsWith('decimetre')) return 0.1;
  if (m === 'cm' || m.startsWith('centimetre')) return 0.01;
  if (m === 'mm' || m.startsWith('millimetre')) return 0.001;
  if (m === 'km' || m.startsWith('kilometre')) return 1000;
  if (m.startsWith('mile')) return 1609.344;
  if (m.startsWith('furlong')) return 201.168;
  if (m.startsWith('yard')) return 0.9144;
  if (m.startsWith('foot') || m === 'ft') return 0.3048;
  if (m.startsWith('inch')) return 0.0254;
  return 1;
}

function rfStr(rf: number): string {
  if (rf === 0) return '0';
  if (rf >= 1) return `${fmt(rf, 2)}`;
  const denom = Math.round(1 / rf);
  return `1:${denom}`;
}

function drawScaleBox(
  builder: StrokeBuilder,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const tl: Pt = { x, y };
  const tr: Pt = { x: x + w, y };
  const bl: Pt = { x, y: y + h };
  const br: Pt = { x: x + w, y: y + h };
  builder.line({
    tool: 'T-Square',
    instruction: 'Top edge of scale rectangle',
    from: tl,
    to: tr,
    layer: 'final',
  });
  builder.line({
    tool: 'T-Square',
    instruction: 'Bottom edge of scale rectangle',
    from: bl,
    to: br,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Left edge of scale rectangle',
    from: tl,
    to: bl,
    layer: 'final',
  });
  builder.line({
    tool: 'Set Square',
    instruction: 'Right edge of scale rectangle',
    from: tr,
    to: br,
    layer: 'final',
  });
}

function titleFor(spec: ScaleSpec): string {
  const k = spec.kind[0].toUpperCase() + spec.kind.slice(1);
  return `${k} Scale — R.F. ${rfStr(spec.rf)}, reads up to ${spec.maxValue} ${spec.mainUnit}`;
}
