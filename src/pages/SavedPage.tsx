import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { listSaved, setSaved } from '@/lib/storage';
import type { SolvedQuestion } from '@/engines/types';
import { IconBookmark } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { QuestionTable } from '@/components/question/QuestionTable';

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
    <PageShell title="Saved" subtitle="Questions you've bookmarked for later">
      {loading ? (
        <div className="font-mono text-[12px] text-text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="border-y border-border-subtle px-8 py-16 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded border border-border-default">
            <IconBookmark className="h-4 w-4 text-text-secondary" />
          </div>
          <h2 className="mt-4 font-display text-[19px] font-normal text-text-primary">
            Nothing saved yet
          </h2>
          <p className="mt-1.5 text-[13px] text-text-secondary">
            When you ask a question and click Save, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <QuestionTable
          items={items}
          dateLabel="Saved"
          onOpen={(q) => navigate(`/app/canvas/${q.id}`)}
          actions={(q) => (
            <>
              <Button size="sm" variant="ghost" onClick={() => handleUnsave(q.id)}>
                Unsave
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
