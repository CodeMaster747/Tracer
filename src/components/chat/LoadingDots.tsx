export function LoadingDots() {
  return (
    <div className="flex max-w-2xl items-center gap-2.5 rounded-xl border border-border-subtle bg-bg-secondary px-5 py-4">
      <span className="u-label">
        Thinking
      </span>
      <div className="flex gap-1">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1 w-1 rounded-full bg-text-secondary animate-pulse-slow"
      style={{ animationDelay: delay }}
    />
  );
}
