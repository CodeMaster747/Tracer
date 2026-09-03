import { motion } from 'framer-motion';
import type { ChatMessage } from '@/engines/types';
import { Button } from '@/components/ui/Button';
import { IconEye, IconBookmark } from '@/components/ui/Icon';

interface Props {
  message: ChatMessage;
  onView?: () => void;
  onSave?: () => void;
}

export function MessageBubble({ message, onView, onSave }: Props) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={isUser ? 'flex justify-end' : 'flex justify-start'}
    >
      <div
        className={
          isUser
            ? 'max-w-2xl rounded-xl bg-ink/[0.06] border border-border-subtle px-4 py-3 text-sm leading-relaxed text-text-primary'
            : 'max-w-2xl rounded-xl bg-bg-secondary border border-border-subtle px-5 py-4 text-sm leading-relaxed text-text-primary'
        }
      >
        {!isUser && (
          <div className="mb-2 u-label">
            Solution Summary
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.refusal && (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-3">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-amber-300">
              Manual Drawing Steps
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-text-secondary">
              {message.refusal.manualInstructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {(onView || onSave) && message.solvedQuestionId && (
          <div className="mt-4 flex gap-2">
            {onView && (
              <Button
                size="sm"
                variant="primary"
                onClick={onView}
                leftIcon={<IconEye className="h-3.5 w-3.5" />}
              >
                Open
              </Button>
            )}
            {onSave && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onSave}
                leftIcon={<IconBookmark className="h-3.5 w-3.5" />}
              >
                Save
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
