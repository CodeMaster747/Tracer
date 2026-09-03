import { motion, AnimatePresence } from 'framer-motion';
import type { Stroke } from '@/engines/types';
import { formatMm } from '@/lib/utils';

interface Props {
  stroke: Stroke | null;
}

export function StrokeAnalysisPanel({ stroke }: Props) {
  return (
    <aside className="w-[280px] shrink-0 border-r border-border-subtle bg-bg-secondary">
      <div className="border-b border-border-subtle px-5 py-4">
        <div className="u-label">
          Stroke Analysis
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stroke ? (
          <motion.div
            key={stroke.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-5 px-5 py-5"
          >
            <Field label="Step Order" value={`#${stroke.order}`} mono />
            <Field label="Required Tool" value={stroke.tool} />
            <Field label="Instruction" value={stroke.instruction} />

            <div>
              <div className="u-label">
                Coordinates
              </div>
              <div className="mt-2 space-y-2 rounded-lg border border-border-subtle bg-ink/[0.02] px-3 py-3">
                <Coord label="Start" pt={stroke.startMm} />
                <div className="h-px bg-border-subtle" />
                <Coord label="End" pt={stroke.endMm} />
              </div>
            </div>

            {stroke.radiusMm !== undefined && (
              <Field
                label="Radius"
                value={formatMm(stroke.radiusMm)}
                mono
              />
            )}

            {stroke.layer && (
              <Field label="Layer" value={stroke.layer} subtle />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 py-10 text-center text-xs text-text-muted"
          >
            Hover or click any stroke to inspect it.
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

function Field({
  label,
  value,
  mono,
  subtle,
}: {
  label: string;
  value: string;
  mono?: boolean;
  subtle?: boolean;
}) {
  return (
    <div>
      <div className="u-label">
        {label}
      </div>
      <div
        className={[
          'mt-1.5 text-sm leading-snug',
          mono ? 'font-mono' : '',
          subtle ? 'text-text-secondary' : 'text-text-primary',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function Coord({ label, pt }: { label: string; pt: { x: number; y: number } }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted">
        {label}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-3 font-mono text-xs text-text-primary">
        <span>X: {formatMm(pt.x)}</span>
        <span>Y: {formatMm(pt.y)}</span>
      </div>
    </div>
  );
}
