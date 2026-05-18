import type { CSSProperties } from 'react';
import type { Stroke } from '@/engines/types';
import { getStrokeColors, getStrokeStatus } from './strokeColor';
import { computeStrokeLength } from './strokeLength';

interface Props {
  stroke: Stroke;
  currentStep: number;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

/** Duration for the draw-on reveal. Comfortably under the 600ms step tick. */
const REVEAL_DURATION_MS = 460;
/** Color/width tween — quick, after reveal completes. */
const COLOR_DURATION_MS = 200;

export function StrokeShape({
  stroke,
  currentStep,
  hovered,
  onHover,
  onClick,
}: Props) {
  const colors = getStrokeColors(stroke, currentStep, hovered);

  if (colors.opacity === 0) return null;

  const status = getStrokeStatus(stroke, currentStep);
  const revealed = status !== 'pending';
  const isText = stroke.geometry.kind === 'text';

  const interactiveProps = {
    onMouseEnter: () => onHover(stroke.id),
    onMouseLeave: () => onHover(null),
    onClick: () => onClick(stroke.id),
    style: { cursor: 'pointer' as const },
  };

  // For non-text strokes, drive a stroke-dashoffset draw-on reveal. Text
  // labels keep their current pop-in (the geometry has no stroke length).
  const length = isText ? 0 : computeStrokeLength(stroke.geometry);
  const revealStyle: CSSProperties = isText
    ? {}
    : {
        strokeDasharray: length > 0 ? length : undefined,
        strokeDashoffset: length > 0 ? (revealed ? 0 : length) : undefined,
        transition: `stroke-dashoffset ${REVEAL_DURATION_MS}ms cubic-bezier(0.25,1,0.5,1), stroke ${COLOR_DURATION_MS}ms ease-out, fill ${COLOR_DURATION_MS}ms ease-out, stroke-width ${COLOR_DURATION_MS}ms ease-out`,
      };

  const common = {
    stroke: colors.stroke,
    strokeWidth: colors.strokeWidth,
    fill: colors.fill,
    opacity: colors.opacity,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
    style: revealStyle,
  };

  const g = stroke.geometry;

  switch (g.kind) {
    case 'line':
      return (
        <g {...interactiveProps}>
          <line
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            {...common}
          />
          <line
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke="transparent"
            strokeWidth={4}
          />
        </g>
      );

    case 'circle':
      return (
        <g {...interactiveProps}>
          <circle cx={g.cx} cy={g.cy} r={g.r} {...common} />
          <circle
            cx={g.cx}
            cy={g.cy}
            r={g.r}
            stroke="transparent"
            strokeWidth={4}
            fill="none"
          />
        </g>
      );

    case 'arc': {
      const x1 = g.cx + g.r * Math.cos(g.startAngle);
      const y1 = g.cy + g.r * Math.sin(g.startAngle);
      const x2 = g.cx + g.r * Math.cos(g.endAngle);
      const y2 = g.cy + g.r * Math.sin(g.endAngle);
      const largeArc = Math.abs(g.endAngle - g.startAngle) > Math.PI ? 1 : 0;
      const sweep = g.anticlockwise ? 0 : 1;
      const d = `M ${x1} ${y1} A ${g.r} ${g.r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
      return (
        <g {...interactiveProps}>
          <path d={d} {...common} />
        </g>
      );
    }

    case 'curve': {
      if (g.points.length < 2) return null;
      const d =
        `M ${g.points[0].x} ${g.points[0].y} ` +
        g.points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ') +
        (g.closed ? ' Z' : '');
      return (
        <g {...interactiveProps}>
          <path d={d} {...common} />
        </g>
      );
    }

    case 'polygon': {
      if (g.points.length < 2) return null;
      const d =
        `M ${g.points[0].x} ${g.points[0].y} ` +
        g.points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ') +
        ' Z';
      return (
        <g {...interactiveProps}>
          <path d={d} {...common} />
        </g>
      );
    }

    case 'arrow': {
      const dx = g.x2 - g.x1;
      const dy = g.y2 - g.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const head = g.headSize ?? 4;
      const baseX = g.x2 - ux * head;
      const baseY = g.y2 - uy * head;
      const px = -uy;
      const py = ux;
      const leftX = baseX + px * (head * 0.5);
      const leftY = baseY + py * (head * 0.5);
      const rightX = baseX - px * (head * 0.5);
      const rightY = baseY - py * (head * 0.5);
      // Head fades in near the end of the shaft reveal so it visually
      // "lands" at the same moment the shaft completes.
      const headOpacity = revealed ? colors.opacity : 0;
      const headDelay = Math.max(0, REVEAL_DURATION_MS - COLOR_DURATION_MS);
      const headStyle: CSSProperties = {
        opacity: headOpacity,
        transition: `opacity ${COLOR_DURATION_MS}ms ease-out ${headDelay}ms, stroke ${COLOR_DURATION_MS}ms ease-out, fill ${COLOR_DURATION_MS}ms ease-out`,
      };
      return (
        <g {...interactiveProps}>
          <line
            x1={g.x1}
            y1={g.y1}
            x2={baseX}
            y2={baseY}
            {...common}
          />
          <path
            d={`M ${g.x2} ${g.y2} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`}
            stroke={colors.stroke}
            strokeWidth={colors.strokeWidth}
            fill={colors.stroke}
            strokeLinejoin="round"
            style={headStyle}
          />
          <line
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke="transparent"
            strokeWidth={4}
          />
        </g>
      );
    }

    case 'text': {
      const fontSize = g.fontSize ?? 4;
      const anchor = g.align ?? 'start';
      const baseline = g.baseline ?? 'auto';
      return (
        <g {...interactiveProps}>
          <text
            x={g.x}
            y={g.y}
            fill={colors.stroke}
            fontSize={fontSize}
            opacity={colors.opacity}
            textAnchor={anchor}
            dominantBaseline={baseline}
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight={500}
          >
            {g.text}
          </text>
        </g>
      );
    }

    default:
      return null;
  }
}
