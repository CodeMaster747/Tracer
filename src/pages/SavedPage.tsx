import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { listSaved, setSaved } from '@/lib/storage';
import type { Domain, SolvedQuestion } from '@/engines/types';
import {
  IconBookmark,
  IconCompass,
  IconAutomata,
  IconControl,
  IconEye,
} from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

const DOMAIN_META: Record<
  Domain,
  { label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  graphics: { label: 'Graphics', Icon: IconCompass },
  automata: { label: 'Automata', Icon: IconAutomata },
  control: { label: 'Control', Icon: IconControl },
};

export default function SavedPage() {
  const navigate = useNavigate();
  const uid = useAuthStore((s) => s.user?.uid);
  const [items, setItems] = useState<SolvedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    listSaved(uid)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [uid]);

  const handleUnsave = async (id: string) => {
    if (!uid) return;
    await setSaved(uid, id, false);
    setItems((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-4xl px-8 py-12"
      >
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Questions you've bookmarked for later
          </p>
        </header>

        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-secondary px-8 py-16 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-white/[0.03]">
              <IconBookmark className="h-4 w-4 text-text-secondary" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-text-primary">
              Nothing saved yet
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              When you ask a question and click Save, it'll appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">
            {items.map((q, i) => (
              <div key={q.id}>
                {i > 0 && <div className="h-px bg-border-subtle" />}
                <SavedRow
                  q={q}
                  onOpen={() => navigate(`/app/canvas/${q.id}`)}
                  onUnsave={() => handleUnsave(q.id)}
                />
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SavedRow({
  q,
  onOpen,
  onUnsave,
}: {
  q: SolvedQuestion;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const { label, Icon } = DOMAIN_META[q.domain];
  return (
    <div className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-white/[0.02]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-white/[0.03]">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text-primary">
          {q.title}
        </div>
        <div className="mt-1 text-xs text-text-muted">{label}</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onUnsave}>
          Unsave
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onOpen}
          leftIcon={<IconEye className="h-3.5 w-3.5" />}
        >
          Open
        </Button>
      </div>
    </div>
  );
}
