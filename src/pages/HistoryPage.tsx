import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { listHistory, deleteQuestion } from '@/lib/storage';
import type { Domain, SolvedQuestion } from '@/engines/types';
import { IconHistory } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { QuestionTable } from '@/components/question/QuestionTable';
import { DOMAIN_META } from '@/components/question/domainMeta';

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
    <PageShell title="History" subtitle="Questions you've opened recently">
      {loading ? (
        <div className="font-mono text-[12px] text-text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <QuestionTable
          items={items}
          dateLabel="Opened"
          onOpen={(q) => navigate(`/app/canvas/${q.id}`)}
          actions={(q) => (
            <>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)}>
                Delete
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/app/canvas/${q.id}`)}
              >
                Open
              </Button>
            </>
          )}
        />
      )}
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="border-y border-border-subtle px-8 py-16 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded border border-border-default">
        <IconHistory className="h-4 w-4 text-text-secondary" />
      </div>
      <h2 className="mt-4 font-display text-[19px] font-normal text-text-primary">
        No history yet
      </h2>
      <p className="mt-1.5 text-[13px] text-text-secondary">
        Open a question from one of the modules below to see it here.
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
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-3 text-xs font-medium text-text-secondary transition-colors duration-150 hover:border-border-strong hover:text-text-primary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
