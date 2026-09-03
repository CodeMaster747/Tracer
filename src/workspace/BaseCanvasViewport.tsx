import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleViewport } from './types';
import { Button } from '@/components/ui/Button';
import { IconPlus, IconMinus, IconReset } from '@/components/ui/Icon';

interface Props {
  viewport: ModuleViewport;
  children: ReactNode;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.25;

/**
 * Generalised canvas viewport: dark outer frame with dot grid, pan/zoom
 * controls, and an inner SVG sized to the module's viewport spec. Module
 * children are rendered inside the SVG at user-unit coordinates.
 */
export const BaseCanvasViewport = forwardRef<SVGSVGElement, Props>(
  function BaseCanvasViewport({ viewport, children }, svgRef) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [fitZoom, setFitZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const unitScale = viewport.unitScale ?? 1;
    const bg = viewport.background ?? 'transparent';
    const showPaperEdge = viewport.showPaperEdge ?? false;

    // Compute fit-to-container zoom whenever viewport size or container size changes.
    useEffect(() => {
      const compute = () => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const padding = 80;
        const sx =
          (rect.width - padding) / (viewport.widthUnits * unitScale);
        const sy =
          (rect.height - padding) / (viewport.heightUnits * unitScale);
        const fit = Math.max(MIN_ZOOM, Math.min(sx, sy, 1.5));
        setFitZoom(fit);
        setZoom(fit);
        setPan({ x: 0, y: 0 });
      };
      compute();
      const obs = new ResizeObserver(compute);
      if (containerRef.current) obs.observe(containerRef.current);
      return () => obs.disconnect();
    }, [viewport.widthUnits, viewport.heightUnits, unitScale]);

    // Pan with click-drag on empty viewport; zoom with Ctrl/Cmd+wheel.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      let dragging = false;
      let last = { x: 0, y: 0 };

      const onDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('[data-stroke-hit]')) return;
        dragging = true;
        last = { x: e.clientX, y: e.clientY };
        el.style.cursor = 'grabbing';
      };
      const onMove = (e: MouseEvent) => {
        if (!dragging) return;
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      };
      const onUp = () => {
        dragging = false;
        el.style.cursor = '';
      };
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
      };

      el.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        el.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        el.removeEventListener('wheel', onWheel);
      };
    }, []);

    const zoomPct = Math.round((zoom / fitZoom) * 100);
    const reset = () => {
      setZoom(fitZoom);
      setPan({ x: 0, y: 0 });
    };
    const zoomIn = () =>
      setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
    const zoomOut = () =>
      setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden bg-bg-primary"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(20,23,26,0.045) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div className="absolute left-4 top-4 z-10 flex items-center gap-0.5 rounded-lg border border-border-subtle bg-bg-secondary p-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            <IconMinus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[2.75rem] px-1 text-center font-mono text-[11px] tabular-nums text-text-secondary">
            {zoomPct}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            <IconPlus className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border-subtle" />
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            aria-label="Reset view"
          >
            <IconReset className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * unitScale})`,
            transformOrigin: 'center',
            transition: 'transform 60ms ease-out',
          }}
        >
          <svg
            ref={svgRef}
            width={viewport.widthUnits}
            height={viewport.heightUnits}
            viewBox={`0 0 ${viewport.widthUnits} ${viewport.heightUnits}`}
            style={{
              background: bg,
              border: showPaperEdge ? '1px solid rgba(20,23,26,0.08)' : 'none',
              borderRadius: '2px',
            }}
          >
            {children}
          </svg>
        </div>
      </div>
    );
  }
);
