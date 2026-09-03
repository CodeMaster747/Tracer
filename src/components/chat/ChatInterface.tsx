import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Domain } from '@/engines/types';
import { useChatStore } from '@/stores/chat.store';
import { ExampleCard } from './ExampleCard';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { LoadingDots } from './LoadingDots';
import { Button } from '@/components/ui/Button';
import { IconEye, IconBookmark } from '@/components/ui/Icon';
import type { ComponentType, SVGProps } from 'react';

interface Props {
  domain: Domain;
  title: string;
  subtitle: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export function ChatInterface({ domain, title, subtitle, Icon }: Props) {
  const navigate = useNavigate();
  const { byDomain, examples, ask, openExample, saveExample } = useChatStore();
  const state = byDomain[domain];
  const list = examples[domain];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [state.messages.length, state.pending]);

  const showToast = (text: string) => {
    setSavedToast(text);
    setTimeout(() => setSavedToast(null), 2200);
  };

  const handleViewExample = async (id: string) => {
    const q = await openExample(id);
    if (q) navigate(`/app/canvas/${q.id}`);
  };

  const handleSaveExample = async (id: string) => {
    const q = await saveExample(id);
    if (q) showToast('Saved');
  };

  const handleAsk = async (text: string) => {
    await ask(domain, text);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-8 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-ink/[0.03]">
          <Icon className="h-4 w-4 text-text-secondary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-text-primary">
            {title}
          </h1>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {state.messages.length === 0 && (
            <section>
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Example questions
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((ex) => (
                  <ExampleCard
                    key={ex.id}
                    title={ex.title}
                    onView={() => handleViewExample(ex.id)}
                    onSave={() => handleSaveExample(ex.id)}
                  />
                ))}
                {list.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-border-subtle px-6 py-8 text-center text-sm text-text-muted">
                    Type your own question below to get started.
                  </div>
                )}
              </div>
            </section>
          )}

          {state.messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onView={
                m.solvedQuestionId
                  ? () => navigate(`/app/canvas/${m.solvedQuestionId}`)
                  : undefined
              }
              onSave={() => showToast('Already saved to History')}
            />
          ))}

          <AnimatePresence>
            {state.pending && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <LoadingDots />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-border-subtle px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            onSend={handleAsk}
            disabled={state.pending}
            placeholder={placeholderFor(domain)}
          />
        </div>
      </div>

      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-xs font-medium text-text-primary"
          >
            {savedToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function placeholderFor(d: Domain): string {
  switch (d) {
    case 'graphics':
      return 'e.g. Draw projections of a point 50mm above HP and 30mm in front of VP';
    case 'automata':
      return 'e.g. Construct an NFA accepting strings ending in 01';
    case 'control':
      return 'e.g. Plot pole-zero of G(s) = (s+2) / [(s+1)(s+3)]';
  }
}

export function ExampleCardActions({
  onView,
  onSave,
}: {
  onView: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="primary"
        onClick={onView}
        leftIcon={<IconEye className="h-3.5 w-3.5" />}
      >
        Open
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={onSave}
        leftIcon={<IconBookmark className="h-3.5 w-3.5" />}
      >
        Save
      </Button>
    </div>
  );
}
