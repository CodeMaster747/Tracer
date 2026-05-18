import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { IconDownload } from '@/components/ui/Icon';

interface Props {
  onExportPng: () => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
}

export function ExportMenu({ onExportPng, onExportPdf }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const wrap = (kind: 'png' | 'pdf', fn: () => void | Promise<void>) => async () => {
    setBusy(kind);
    try {
      await fn();
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        size="md"
        onClick={() => setOpen((o) => !o)}
        leftIcon={<IconDownload className="h-3.5 w-3.5" />}
        loading={busy !== null}
      >
        Export
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-lg border border-border-default bg-bg-elevated"
          >
            <button
              onClick={wrap('png', onExportPng)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between px-3 py-2.5 text-[13px] text-text-primary transition-colors duration-150 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <span>PNG image</span>
              {busy === 'png' && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
              )}
            </button>
            <div className="h-px bg-border-subtle" />
            <button
              onClick={wrap('pdf', onExportPdf)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between px-3 py-2.5 text-[13px] text-text-primary transition-colors duration-150 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <span>PDF document</span>
              {busy === 'pdf' && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
