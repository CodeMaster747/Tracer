import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  question: string;
  summary: string;
  onClose: () => void;
}

export function QuestionModal({ open, question, summary, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border-default bg-bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border-subtle px-6 py-4">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-muted">
                Original Question
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm leading-relaxed text-text-primary">
                {question}
              </p>
              <div className="rounded-lg border border-border-subtle bg-white/[0.02] px-4 py-3">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
                  Summary
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {summary}
                </p>
              </div>
            </div>
            <div className="flex justify-end border-t border-border-subtle px-6 py-3">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
