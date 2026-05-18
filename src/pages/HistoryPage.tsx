import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { listHistory, deleteQuestion } from '@/lib/storage';
import type { Domain, SolvedQuestion } from '@/engines/types';
import {
  IconHistory,
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

export default function HistoryPage() {
  const navigate = useNavigate();
  const uid = useAuthStore((s) => s.user?.uid);
  const [items, setItems] = useState<SolvedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    listHistory(uid)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [uid]);

  const handleDelete = async (id: string) => {
    if (!uid) return;
    await deleteQuestion(uid, id);
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
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Questions you've opened recently
          </p>
        </header>

        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">
            {items.map((q, i) => (
              <div key={q.id}>
                {i > 0 && <div className="h-px bg-border-subtle" />}
                <QuestionRow
                  q={q}
                  onOpen={() => navigate(`/app/canvas/${q.id}`)}
                  onDelete={() => handleDelete(q.id)}
                />
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary px-8 py-16 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-white/[0.03]">
        <IconHistory className="h-4 w-4 text-text-secondary" />
      </div>
      <h2 className="mt-4 text-sm font-semibold text-text-primary">
        No history yet
      </h2>
      <p className="mt-1.5 text-sm text-text-secondary">
        Open a question from one of the domains below to see it here.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <DomainLink to="/app/graphics" domain="graphics" />
        <DomainLink to="/app/automata" domain="automata" />
        <DomainLink to="/app/control" domain="control" />
      </div>
    </div>
  );
}

function DomainLink({ to, domain }: { to: string; domain: Domain }) {
  const { label, Icon } = DOMAIN_META[domain];
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-white/[0.05] hover:text-text-primary hover:border-border-default"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function QuestionRow({
  q,
  onOpen,
  onDelete,
}: {
  q: SolvedQuestion;
  onOpen: () => void;
  onDelete: () => void;
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
        <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <span>{label}</span>
          <span className="text-text-dim">·</span>
          <span>{formatDate(q.createdAt)}</span>
          {q.savedAt && (
            <>
              <span className="text-text-dim">·</span>
              <span className="text-text-secondary">Saved</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Button size="sm" variant="ghost" onClick={onDelete}>
          Delete
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

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
