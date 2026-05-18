import type { SolverResult } from '@/engines/types';
import { paperSpec } from '@/engines/types';
import { buildPointProjection, type ProjectionAngle } from './point';
import { buildLineProjection, buildInclinedLineProjection } from './line';
import { buildEllipseConcentric, buildParabolaRectangle } from './conic';
import { buildCycloid, buildInvoluteOfCircle } from './curves';
import { buildIsoCube, buildIsoCylinder, buildIsoCone } from './isometric';
import { buildPlaneProjection, type PlaneOrientation, type PlaneShape } from './plane';
import { buildSolidProjection, type AxisPose, type SolidShape } from './solid';
import { buildSectionOfSolid, type SectionSolidShape } from './section';
import { buildDevelopment, type DevelopmentSolidShape } from './development';
import {
  buildArchimedeanSpiral,
  buildEpiOrHypoCycloid,
  buildHelix,
  buildHyperbola,
} from './moreCurves';
import { buildScale, type ScaleKind } from './scales';
import { buildOrthographicBlock, buildAuxiliaryView } from './orthographic';

/* ============================================================ *
 *  Tokenization helpers
 * ============================================================ */

const NUM = '(\\d+(?:\\.\\d+)?)';

function thirdAngle(text: string): boolean {
  return /third\s*[-\s]?angle/i.test(text);
}

/* ============================================================ *
 *  Topic recognisers — order matters; more specific first.
 * ============================================================ */

interface Recogniser {
  name: string;
  test: (q: string) => boolean;
  run: (q: string) => SolverResult | null;
}

const RECOGNISERS: Recogniser[] = [
  /* ---- Scales (must come before "draw a scale of ... line ...") ---- */
  scaleRecogniser(),

  /* ---- Development of surfaces ---- */
  developmentRecogniser(),

  /* ---- Section of solids ---- */
  sectionRecogniser(),

  /* ---- Projections of solids ---- */
  solidProjectionRecogniser(),

  /* ---- Projections of planes ---- */
  planeProjectionRecogniser(),

  /* ---- Engineering curves ---- */
  helixRecogniser(),
  epiHypoRecogniser(),
  spiralRecogniser(),
  hyperbolaRecogniser(),

  /* ---- Auxiliary view ---- */
  auxiliaryViewRecogniser(),

  /* ---- Orthographic block ---- */
  orthographicBlockRecogniser(),

  /* ---- Lines (advanced inclination form) ---- */
  inclinedLineRecogniser(),

  /* ---- Original 2-endpoint line ---- */
  twoEndpointLineRecogniser(),

  /* ---- Original point ---- */
  pointRecogniser(),

  /* ---- Conics ---- */
  ellipseRecogniser(),
  parabolaRecogniser(),

  /* ---- Plain cycloid / involute ---- */
  cycloidRecogniser(),
  involuteRecogniser(),

  /* ---- Isometric ---- */
  isoCubeRecogniser(),
  isoCylinderRecogniser(),
  isoConeRecogniser(),
];

/* ============================================================ *
 *  Entry point
 * ============================================================ */

export function solveGraphicsQuestion(text: string): SolverResult {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  for (const r of RECOGNISERS) {
    if (r.test(cleaned)) {
      try {
        const out = r.run(cleaned);
        if (out) return out;
      } catch (e) {
        return refusal(
          `I recognised this as a ${r.name} problem but could not finish solving it: ${
            (e as Error).message
          }`,
          [
            'Check that all required numeric values (dimensions, angles, counts) are present.',
            'Ensure inclinations to HP plus inclinations to VP do not exceed 90°.',
          ]
        );
      }
    }
  }
  return refusalGeneric();
}

/* ============================================================ *
 *  Individual recognisers
 * ============================================================ */

function scaleRecogniser(): Recogniser {
  const RE = /\b(plain|diagonal|vernier|comparative)\s+scale\b/i;
  return {
    name: 'scale',
    test: (q) => RE.test(q),
    run: (q) => {
      const kindM = q.match(RE);
      if (!kindM) return null;
      const kind = kindM[1].toLowerCase() as ScaleKind;
      const rfStr = q.match(/(?:r\.f\.?|representative\s*fraction|scale)\s*(?:=|of|is|:)?\s*1\s*[/:\\]\s*(\d+)/i);
      const rf = rfStr ? 1 / parseInt(rfStr[1], 10) : 1 / 100;
      const maxM = q.match(new RegExp(`(?:read|measure|maximum|max|up\\s*to)\\s*${NUM}\\s*(metre|meter|m|kilometre|km|cm|dm|mile|yard|foot|inch)s?`, 'i'));
      const maxValue = maxM ? parseFloat(maxM[1]) : 6;
      const mainUnit = maxM ? maxM[2] : 'metre';
      const subUnit = q.match(/(?:and|to)\s+(decimetre|dm|centimetre|cm|millimetre|mm|inch|foot|yard|furlong)s?/i)?.[1] ?? 'decimetre';
      const tertiary = q.match(/(?:cm|centimetre|millimetre|mm)/i)?.[0];
      const compMatch = q.match(/(km|kilometre|mile|miles|yard|foot|metre|meter)\s*(?:↔|and|vs|to)\s*(km|kilometre|mile|miles|yard|foot|metre|meter)/i);
      const backward = /backward/i.test(q);

      const res = buildScale({
        kind,
        rf,
        maxValue,
        mainUnit,
        subUnit,
        tertiaryUnit: tertiary,
        backwardVernier: backward,
        secondaryUnit: compMatch?.[2] ?? 'mile',
        secondaryConversion: parseSecondaryConversion(mainUnit, compMatch?.[2]),
      });
      return success(res);
    },
  };
}

function parseSecondaryConversion(main: string, sec?: string): number {
  if (!sec) return 1.609;
  const a = main.toLowerCase();
  const b = sec.toLowerCase();
  // unit-per-main
  const inMetres = (u: string) =>
    u.startsWith('m') && !u.startsWith('mi') ? 1 :
    u === 'km' || u.startsWith('km') || u.startsWith('kilo') ? 1000 :
    u.startsWith('mile') ? 1609.344 :
    u.startsWith('yard') ? 0.9144 :
    u.startsWith('foot') ? 0.3048 :
    u.startsWith('inch') ? 0.0254 :
    1;
  return inMetres(a) / inMetres(b);
}

function developmentRecogniser(): Recogniser {
  const ADJ = '(?:triangular\\s+|square\\s+|rectangular\\s+|pentagonal\\s+|hexagonal\\s+|heptagonal\\s+|octagonal\\s+|right\\s+|regular\\s+|truncated\\s+)?';
  const RE = new RegExp(`\\bdevelopment\\s+of\\s+(?:the\\s+)?(?:lateral\\s+)?surface(?:s)?\\s+of\\s+(?:a|an|the)?\\s*${ADJ}(prism|pyramid|cylinder|cone)`, 'i');
  const REalt = new RegExp(`develop\\s+(?:the\\s+)?(?:surface|lateral)?(?:\\s+of)?\\s+(?:a|an)?\\s*${ADJ}(prism|pyramid|cylinder|cone)`, 'i');
  return {
    name: 'development of surface',
    test: (q) => RE.test(q) || REalt.test(q),
    run: (q) => {
      const m = q.match(RE) ?? q.match(REalt);
      if (!m) return null;
      const shape = m[1].toLowerCase() as DevelopmentSolidShape;
      const sizeMm = pickFirst(q, new RegExp(`(?:side|edge|base\\s*(?:side)?|base\\s*diameter|diameter)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? pickAny(q, [70, 50, 40, 60]) ?? 40;
      const axisMm = pickAxisHeight(q);
      const sides = pickSides(q) ?? defaultSidesFor(shape);
      return success(buildDevelopment({ shape, sizeMm, axisMm, sides }));
    },
  };
}

function sectionRecogniser(): Recogniser {
  const ADJ = '(?:triangular\\s+|square\\s+|rectangular\\s+|pentagonal\\s+|hexagonal\\s+|heptagonal\\s+|octagonal\\s+|right\\s+|regular\\s+)?';
  const RE = new RegExp(`\\bsection\\s+(?:of|through|on)\\s+(?:a|an|the)?\\s*${ADJ}(cube|cylinder|cone|prism|pyramid)`, 'i');
  return {
    name: 'section of solid',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      const shape = m[1].toLowerCase() as SectionSolidShape;
      const sizeMm = pickFirst(q, new RegExp(`(?:side|edge|base|diameter)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 60;
      const axisMm = pickAxisHeight(q) ?? sizeMm * 1.4;
      const incl = pickFirst(q, new RegExp(`(?:inclined|at)\\s*${NUM}\\s*°?\\s*(?:to\\s*hp|with\\s*hp|to\\s*the\\s*hp)`, 'i')) ??
                   pickFirst(q, new RegExp(`${NUM}\\s*°\\s*(?:to|with)\\s*hp`, 'i')) ?? 45;
      const cutHeightFracMatch = q.match(new RegExp(`(?:through|at)\\s+(?:a\\s+point\\s+)?${NUM}\\s*mm\\s+(?:above|from)`, 'i'));
      const cutAbsMm = cutHeightFracMatch ? parseFloat(cutHeightFracMatch[1]) : axisMm * 0.45;
      const cutHeightFrac = Math.max(0.1, Math.min(0.95, cutAbsMm / axisMm));
      const sides = pickSides(q) ?? defaultSidesFor(shape);
      return success(buildSectionOfSolid({
        shape,
        sizeMm,
        axisMm,
        sides,
        cutInclinationDeg: incl,
        cutHeightFrac,
      }));
    },
  };
}

function solidProjectionRecogniser(): Recogniser {
  const ADJ = '(?:triangular\\s+|square\\s+|rectangular\\s+|pentagonal\\s+|hexagonal\\s+|heptagonal\\s+|octagonal\\s+|right\\s+|regular\\s+|truncated\\s+)?';
  const RE = new RegExp(`\\bprojection(?:s)?\\s+of\\s+(?:a|an|the)?\\s*${ADJ}(cube|tetrahedron|prism|pyramid|cylinder|cone)`, 'i');
  return {
    name: 'projection of solid',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      const shape = m[1].toLowerCase() as SolidShape;
      const sizeMm = pickFirst(q, new RegExp(`(?:side|edge|base\\s*side|base\\s*diameter|diameter)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 40;
      const axisMm = pickAxisHeight(q);
      const sides = pickSides(q) ?? defaultSidesFor(shape);
      const pose: AxisPose = pickAxisPose(q);
      const inclinationDeg = pose.startsWith('inclined-')
        ? pickFirst(q, new RegExp(`${NUM}\\s*°(?:\\s*(?:to|with)\\s*(?:hp|vp))?`, 'i')) ?? 30
        : undefined;
      return success(buildSolidProjection({
        shape,
        sizeMm,
        axisMm,
        sides,
        pose,
        inclinationDeg,
      }));
    },
  };
}

function planeProjectionRecogniser(): Recogniser {
  const RE = /\bprojection(?:s)?\s+of\s+(?:a|an|the)?\s*(triangle|square|pentagon|hexagon|circle)/i;
  const REalt = /(triangle|square|pentagon|hexagon|circle)\s+(?:lying|resting|with).*?(parallel|perpendicular|inclined)\s+to\s+(hp|vp)/i;
  return {
    name: 'projection of plane',
    test: (q) => RE.test(q) || REalt.test(q),
    run: (q) => {
      const m = q.match(RE) ?? q.match(REalt);
      if (!m) return null;
      const shape = m[1].toLowerCase() as PlaneShape;
      const sizeMm = pickFirst(q, new RegExp(`(?:side|edge|diameter|of\\s*size)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ??
                     pickFirst(q, new RegExp(`${NUM}\\s*mm\\s*(?:side|diameter)`, 'i')) ??
                     50;
      const orientation: PlaneOrientation = pickPlaneOrientation(q);
      const inclinationDeg = orientation.startsWith('inclined-')
        ? pickFirst(q, new RegExp(`${NUM}\\s*°`, 'i')) ?? 30
        : undefined;
      return success(buildPlaneProjection({
        shape,
        sizeMm,
        orientation,
        inclinationDeg,
      }));
    },
  };
}

function helixRecogniser(): Recogniser {
  const RE = /\bhelix\b/i;
  return {
    name: 'helix',
    test: (q) => RE.test(q),
    run: (q) => {
      const d = pickFirst(q, new RegExp(`diameter\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 50;
      const pitch = pickFirst(q, new RegExp(`(?:pitch|axial\\s+rise)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 50;
      const turns = pickInt(q, /(\d+)\s*(?:turns|convolutions|revolutions)/i) ?? 2;
      return success(buildHelix({ diameterMm: d, pitchMm: pitch, turns }));
    },
  };
}

function epiHypoRecogniser(): Recogniser {
  const RE = /\b(epi|hypo)cycloid\b/i;
  return {
    name: 'epi/hypocycloid',
    test: (q) => RE.test(q),
    run: (q) => {
      const k = q.match(RE)![1].toLowerCase() as 'epi' | 'hypo';
      const r = pickFirst(q, new RegExp(`(?:rolling|small)\\s+(?:circle\\s+)?(?:of\\s+)?diameter\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 30;
      const R = pickFirst(q, new RegExp(`(?:base|directing|large|fixed)\\s+(?:circle\\s+)?(?:of\\s+)?diameter\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 100;
      return success(buildEpiOrHypoCycloid({ rollDiameterMm: r, baseDiameterMm: R, kind: k }));
    },
  };
}

function spiralRecogniser(): Recogniser {
  const RE = /\b(archimed(?:e|i)an\s+)?spiral\b/i;
  return {
    name: 'archimedean spiral',
    test: (q) => RE.test(q),
    run: (q) => {
      const r1 = pickFirst(q, new RegExp(`(?:final|outer|max|end)\\s*(?:radius|R)?\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ??
                 pickFirst(q, new RegExp(`(?:radius|of\\s+radius)\\s*${NUM}\\s*mm`, 'i')) ?? 60;
      const r0 = pickFirst(q, new RegExp(`(?:start|initial|inner)\\s*(?:radius|R)?\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 0;
      const turns = pickInt(q, /(\d+)\s*(?:turns|convolutions|revolutions)/i) ?? 1;
      return success(buildArchimedeanSpiral({ startRadius: r0, endRadius: r1, turns }));
    },
  };
}

function hyperbolaRecogniser(): Recogniser {
  const RE = /\b(rectangular\s+)?hyperbola\b/i;
  return {
    name: 'hyperbola',
    test: (q) => RE.test(q),
    run: (q) => {
      const abscissa = pickFirst(q, new RegExp(`(?:abscissa|x|x-coord)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 40;
      const ordinate = pickFirst(q, new RegExp(`(?:ordinate|y|y-coord)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 30;
      const w = pickFirst(q, new RegExp(`width\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? abscissa * 2;
      const h = pickFirst(q, new RegExp(`height\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? ordinate * 2;
      return success(buildHyperbola({
        widthMm: w,
        heightMm: h,
        abscissaMm: abscissa,
        ordinateMm: ordinate,
      }));
    },
  };
}

function auxiliaryViewRecogniser(): Recogniser {
  const RE = /\bauxiliary\s+view\b/i;
  return {
    name: 'auxiliary view',
    test: (q) => RE.test(q),
    run: (q) => {
      const w = pickFirst(q, new RegExp(`width\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 60;
      const d = pickFirst(q, new RegExp(`depth\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 40;
      const h = pickFirst(q, new RegExp(`height\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 50;
      const angle = pickFirst(q, new RegExp(`${NUM}\\s*°`, 'i')) ?? 45;
      return success(buildAuxiliaryView({
        width: w,
        depth: d,
        height: h,
        faceInclinationDeg: angle,
      }));
    },
  };
}

function orthographicBlockRecogniser(): Recogniser {
  const RE = /\b(orthographic|three\s*views?|front\s+and\s+top\s+and\s+side)/i;
  return {
    name: 'orthographic block',
    test: (q) => RE.test(q),
    run: (q) => {
      const w = pickFirst(q, new RegExp(`width\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 80;
      const d = pickFirst(q, new RegExp(`depth\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 50;
      const h = pickFirst(q, new RegExp(`height\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i')) ?? 40;
      const cutW = pickFirst(q, new RegExp(`cutout\\s*(?:width)?\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i'));
      const cutD = pickFirst(q, new RegExp(`cutout\\s*depth\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i'));
      const cutH = pickFirst(q, new RegExp(`cutout\\s*height\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i'));
      const angle: 'first' | 'third' = thirdAngle(q) ? 'third' : 'first';
      return success(buildOrthographicBlock({
        width: w,
        depth: d,
        height: h,
        cutout: cutW && cutD && cutH ? { widthMm: cutW, depthMm: cutD, heightMm: cutH } : undefined,
        angle,
      }));
    },
  };
}

function inclinedLineRecogniser(): Recogniser {
  // "Line AB 80mm long, inclined 30° to HP, 45° to VP"
  const TEST = /line\s+[A-Z]{2}.*?(?:inclined|at)\s+\d+(?:\.\d+)?\s*°.*?(?:hp|vp)/i;
  const NAME = /line\s+([A-Z]{2})/i;
  // Accepts both "80mm long" and "of length 80mm" forms.
  const LEN_AFTER = new RegExp(`(?:length|long|of\\s+length)\\s*(?:=|of|is)?\\s*${NUM}\\s*mm`, 'i');
  const LEN_BEFORE = new RegExp(`${NUM}\\s*mm\\s*(?:long|in\\s*length)`, 'i');
  const HP_ANG = new RegExp(`${NUM}\\s*°\\s*(?:to|with)?\\s*(?:hp|the\\s*hp)`, 'i');
  const VP_ANG = new RegExp(`${NUM}\\s*°\\s*(?:to|with)?\\s*(?:vp|the\\s*vp)`, 'i');
  const AHP = new RegExp(`end\\s*a\\s*(?:is|at)?\\s*${NUM}\\s*mm\\s*(?:above|below)\\s*hp`, 'i');
  const AVP = new RegExp(`end\\s*a\\s*(?:is|at)?\\s*${NUM}\\s*mm\\s*(?:in\\s*front\\s*of|behind)\\s*vp`, 'i');
  return {
    name: 'inclined line by length+angles',
    test: (q) => TEST.test(q) && /length|long/i.test(q),
    run: (q) => {
      const nameM = q.match(NAME);
      const name = nameM ? nameM[1].toUpperCase() : 'AB';
      const len = q.match(LEN_AFTER) ?? q.match(LEN_BEFORE);
      if (!len) return null;
      const hp = q.match(HP_ANG);
      const vp = q.match(VP_ANG);
      const ahp = q.match(AHP);
      const avp = q.match(AVP);
      const angle: ProjectionAngle = thirdAngle(q) ? 'third' : 'first';
      return success(buildInclinedLineProjection({
        name,
        lengthMm: parseFloat(len[1]),
        hpAngleDeg: hp ? parseFloat(hp[1]) : 0,
        vpAngleDeg: vp ? parseFloat(vp[1]) : 0,
        aHpMm: ahp ? parseFloat(ahp[1]) : 10,
        aVpMm: avp ? parseFloat(avp[1]) : 10,
      }, angle));
    },
  };
}

function twoEndpointLineRecogniser(): Recogniser {
  const RE = new RegExp(
    `line\\s+([A-Z]{2}).*?end\\s+([A-Z])\\s+(?:is\\s+|at\\s+)?${NUM}\\s*mm\\s*(above|below)\\s+hp.*?${NUM}\\s*mm\\s*(in\\s*front\\s*of|behind)\\s+vp.*?end\\s+([A-Z])\\s+(?:is\\s+|at\\s+)?${NUM}\\s*mm\\s*(above|below)\\s+hp.*?${NUM}\\s*mm\\s*(in\\s*front\\s*of|behind)\\s+vp`,
    'i'
  );
  return {
    name: '2-endpoint line',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      const name = m[1].toUpperCase();
      const a = {
        hp: parseFloat(m[3]) * (m[4].toLowerCase().startsWith('above') ? 1 : -1),
        vp: parseFloat(m[5]) * (m[6].toLowerCase().startsWith('in') ? 1 : -1),
      };
      const b = {
        hp: parseFloat(m[8]) * (m[9].toLowerCase().startsWith('above') ? 1 : -1),
        vp: parseFloat(m[10]) * (m[11].toLowerCase().startsWith('in') ? 1 : -1),
      };
      const angle: ProjectionAngle = thirdAngle(q) ? 'third' : 'first';
      return success(buildLineProjection({ name, a, b }, angle));
    },
  };
}

function pointRecogniser(): Recogniser {
  const RE = new RegExp(
    `point\\s+(?:([A-Z])\\s+)?(?:lying\\s+|which\\s+is\\s+|that\\s+is\\s+)?${NUM}\\s*mm\\s*(above|below)\\s+hp.*?${NUM}\\s*mm\\s*(in\\s*front\\s*of|behind)\\s+vp`,
    'i'
  );
  return {
    name: 'projection of point',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      const name = m[1] ? m[1].toUpperCase() : 'A';
      const hp = parseFloat(m[2]) * (m[3].toLowerCase().startsWith('above') ? 1 : -1);
      const vp = parseFloat(m[4]) * (m[5].toLowerCase().startsWith('in') ? 1 : -1);
      const angle: ProjectionAngle = thirdAngle(q) ? 'third' : 'first';
      return success(buildPointProjection({ name, hp, vp }, angle));
    },
  };
}

function ellipseRecogniser(): Recogniser {
  const RE = new RegExp(
    `ellipse.*?(?:major\\s*(?:axis)?\\s*(?:=|of)?\\s*${NUM}\\s*mm).*?(?:minor\\s*(?:axis)?\\s*(?:=|of)?\\s*${NUM}\\s*mm)`,
    'i'
  );
  return {
    name: 'ellipse',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      const major = parseFloat(m[1]);
      const minor = parseFloat(m[2]);
      if (minor > major) {
        return refusal(
          `For an ellipse the major axis must be ≥ minor axis. You gave major=${major}mm, minor=${minor}mm.`,
          ['Re-check the question values; the major axis is the longer one.']
        );
      }
      return success(buildEllipseConcentric({ majorMm: major, minorMm: minor }));
    },
  };
}

function parabolaRecogniser(): Recogniser {
  const RE = new RegExp(
    `parabola.*?(?:abscissa|base|width)\\s*(?:=|of)?\\s*${NUM}\\s*mm.*?(?:ordinate|height|altitude)\\s*(?:=|of)?\\s*${NUM}\\s*mm`,
    'i'
  );
  return {
    name: 'parabola',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      return success(buildParabolaRectangle({
        abscissaMm: parseFloat(m[1]),
        ordinateMm: parseFloat(m[2]),
      }));
    },
  };
}

function cycloidRecogniser(): Recogniser {
  const RE = new RegExp(
    `cycloid.*?(?:diameter|circle\\s+(?:of\\s+)?diameter)\\s*(?:=|of)?\\s*${NUM}\\s*mm`,
    'i'
  );
  return {
    name: 'cycloid',
    test: (q) => RE.test(q) && !/epi|hypo/i.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      return success(buildCycloid({ diameterMm: parseFloat(m[1]) }));
    },
  };
}

function involuteRecogniser(): Recogniser {
  const RE = new RegExp(
    `involute.*?(?:diameter|circle\\s+(?:of\\s+)?diameter)\\s*(?:=|of)?\\s*${NUM}\\s*mm`,
    'i'
  );
  return {
    name: 'involute',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      return success(buildInvoluteOfCircle({ diameterMm: parseFloat(m[1]) }));
    },
  };
}

function isoCubeRecogniser(): Recogniser {
  const RE = new RegExp(`iso(?:metric)?.*?cube.*?(?:side|edge)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i');
  return {
    name: 'isometric cube',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      return success(buildIsoCube({ sideMm: parseFloat(m[1]) }));
    },
  };
}

function isoCylinderRecogniser(): Recogniser {
  const RE = new RegExp(
    `iso(?:metric)?.*?cylinder.*?diameter\\s*(?:=|of)?\\s*${NUM}\\s*mm.*?(?:height|altitude)\\s*(?:=|of)?\\s*${NUM}\\s*mm`,
    'i'
  );
  return {
    name: 'isometric cylinder',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      return success(buildIsoCylinder({
        diameterMm: parseFloat(m[1]),
        heightMm: parseFloat(m[2]),
      }));
    },
  };
}

function isoConeRecogniser(): Recogniser {
  const RE = new RegExp(
    `iso(?:metric)?.*?cone.*?(?:base\\s+diameter|diameter)\\s*(?:=|of)?\\s*${NUM}\\s*mm.*?(?:height|altitude)\\s*(?:=|of)?\\s*${NUM}\\s*mm`,
    'i'
  );
  return {
    name: 'isometric cone',
    test: (q) => RE.test(q),
    run: (q) => {
      const m = q.match(RE);
      if (!m) return null;
      return success(buildIsoCone({
        baseDiameterMm: parseFloat(m[1]),
        heightMm: parseFloat(m[2]),
      }));
    },
  };
}

/* ============================================================ *
 *  Helpers
 * ============================================================ */

function pickFirst(q: string, re: RegExp): number | null {
  const m = q.match(re);
  return m ? parseFloat(m[1]) : null;
}

function pickInt(q: string, re: RegExp): number | null {
  const m = q.match(re);
  return m ? parseInt(m[1], 10) : null;
}

function pickAny(q: string, candidates: number[]): number | null {
  for (const c of candidates) {
    if (new RegExp(`${c}\\s*mm`).test(q)) return c;
  }
  return null;
}

function pickAxisHeight(q: string): number | undefined {
  const re = new RegExp(`(?:height|altitude|axis)\\s*(?:=|of)?\\s*${NUM}\\s*mm`, 'i');
  const m = q.match(re);
  if (m) return parseFloat(m[1]);
  return undefined;
}

function pickSides(q: string): number | null {
  if (/triangular|trian/i.test(q)) return 3;
  if (/square|quadrilateral/i.test(q)) return 4;
  if (/pentagonal|pentagon/i.test(q)) return 5;
  if (/hexagonal|hexagon/i.test(q)) return 6;
  if (/heptagonal/i.test(q)) return 7;
  if (/octagonal|octa/i.test(q)) return 8;
  const m = q.match(/(\d+)[\s-]?sided/i);
  return m ? parseInt(m[1], 10) : null;
}

function defaultSidesFor(shape: string): number {
  switch (shape) {
    case 'triangle':
      return 3;
    case 'square':
      return 4;
    case 'pentagon':
      return 5;
    case 'hexagon':
      return 6;
    case 'prism':
    case 'pyramid':
      return 6;
    default:
      return 4;
  }
}

function pickAxisPose(q: string): AxisPose {
  if (/axis\s+(?:is\s+)?inclined\s+(?:at\s+)?\d+(?:\.\d+)?\s*°?\s*(?:to|with)\s+(?:the\s+)?hp\b/i.test(q)) return 'inclined-to-HP';
  if (/axis\s+(?:is\s+)?inclined\s+(?:at\s+)?\d+(?:\.\d+)?\s*°?\s*(?:to|with)\s+(?:the\s+)?vp\b/i.test(q)) return 'inclined-to-VP';
  if (/axis\s+(?:is\s+)?parallel\s+to\s+both/i.test(q)) return 'parallel-to-both';
  if (/axis\s+(?:is\s+)?(?:perpendicular|⟂)\s+to\s+(?:the\s+)?hp\b/i.test(q)) return 'perpendicular-to-HP';
  if (/axis\s+(?:is\s+)?(?:perpendicular|⟂)\s+to\s+(?:the\s+)?vp\b/i.test(q)) return 'perpendicular-to-VP';
  if (/resting\s+on\s+(?:its\s+)?base|standing/i.test(q)) return 'perpendicular-to-HP';
  if (/lying\s+on\s+(?:its\s+)?side|axis\s+horizontal/i.test(q)) return 'perpendicular-to-VP';
  return 'perpendicular-to-HP';
}

function pickPlaneOrientation(q: string): PlaneOrientation {
  if (/parallel\s+to\s+(?:the\s+)?hp\b/i.test(q)) return 'parallel-to-HP';
  if (/parallel\s+to\s+(?:the\s+)?vp\b/i.test(q)) return 'parallel-to-VP';
  // Tight: a number-then-degrees-then-"to HP" / "to VP" pattern with no intermediate "and"
  if (/inclined\s+(?:at\s+)?\d+(?:\.\d+)?\s*°?\s*(?:to|with)\s+(?:the\s+)?hp\b/i.test(q)) return 'inclined-to-HP';
  if (/inclined\s+(?:at\s+)?\d+(?:\.\d+)?\s*°?\s*(?:to|with)\s+(?:the\s+)?vp\b/i.test(q)) return 'inclined-to-VP';
  if (/resting\s+on\s+(?:the\s+)?hp\b/i.test(q)) return 'parallel-to-HP';
  return 'parallel-to-HP';
}

/* ============================================================ *
 *  Result wrappers
 * ============================================================ */

function success(result: {
  strokes: SolverResult['strokes'];
  paper: SolverResult['paper'];
  summary: string;
}): SolverResult {
  return {
    success: true,
    summary: result.summary,
    paper: result.paper,
    strokes: result.strokes,
  };
}

function refusal(reason: string, manual: string[]): SolverResult {
  return {
    success: false,
    summary: reason,
    paper: paperSpec('A3', 'landscape'),
    strokes: [],
    refusalReason: reason,
    manualInstructions: manual,
  };
}

function refusalGeneric(): SolverResult {
  return refusal(
    'I could not match this Engineering Graphics question to a known construction. Try one of the supported phrasings below.',
    [
      'Projection of a point — "Draw the projections of a point A which is 50mm above HP and 30mm in front of VP."',
      'Projection of a line by endpoints — "Line AB. End A is 20mm above HP and 30mm in front of VP. End B is 60mm above HP and 70mm in front of VP."',
      'Inclined line by length and angles — "Line AB 80mm long, inclined 30° to HP and 45° to VP, end A 15mm above HP and 20mm in front of VP."',
      'Projection of a plane — "Projection of a pentagon of side 30mm parallel to HP." (also: parallel to VP / inclined 30° to HP / inclined 45° to VP).',
      'Projection of a solid — "Projection of a hexagonal pyramid of base side 25mm and axis 60mm, axis perpendicular to HP." (or inclined to HP/VP).',
      'Section of solid — "Section of a cylinder of diameter 60mm and axis 80mm by a plane inclined 45° to HP through 30mm above the base."',
      'Development of surface — "Development of the lateral surface of a hexagonal prism of base 25mm and axis 60mm."',
      'Engineering curves — ellipse, parabola, hyperbola (rectangular), cycloid, epicycloid, hypocycloid, involute, Archimedean spiral, helix.',
      'Scales — plain / diagonal / vernier / comparative ("Plain scale R.F. 1:50 to read 6 metres and decimetres", etc.).',
      'Orthographic & isometric — "Orthographic views of a block 80×50×40mm in first-angle projection."',
      'Auxiliary view — "Auxiliary view of an inclined face tilted 45° to HP on a block 60×40×50mm."',
      'For 3rd-angle projection, append "in third-angle projection" to any of the above.',
    ]
  );
}
