import { useState, type KeyboardEvent } from 'react';
import { IconSend } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const ready = value.trim() && !disabled;

  return (
    <div className="relative flex items-end gap-2 rounded-xl border border-border-subtle bg-bg-secondary p-2 transition-colors duration-150 focus-within:border-border-default">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        rows={1}
        placeholder={placeholder ?? 'Type your question…'}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        style={{ maxHeight: '160px' }}
      />
      <button
        onClick={handleSend}
        disabled={!ready}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
          ready
            ? 'bg-accent-primary text-white hover:bg-accent-secondary'
            : 'bg-ink/[0.04] text-text-muted'
        )}
        aria-label="Send"
      >
        <IconSend className="h-4 w-4" />
      </button>
    </div>
  );
}
