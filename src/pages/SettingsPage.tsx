import { motion } from 'framer-motion';

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-3xl px-8 py-12"
      >
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Configure your Tracer experience
          </p>
        </header>

        <div className="space-y-8">
          <Section title="Storage">
            <Row
              label="Cloud sync"
              status="connected"
              hint="Your history and saved drawings sync across devices via Firebase"
            />
            <Row
              label="Local cache"
              status="connected"
              hint="Drawings are cached in this browser for instant load"
            />
          </Section>

          <Section title="Appearance">
            <Row label="Theme" status="info" hint="Tracer Dark" />
          </Section>

          <Section title="About">
            <Row label="Version" status="info" hint="1.0.0" />
            <Row
              label="Engines"
              status="info"
              hint="Engineering Graphics · Automata · Control Systems"
            />
          </Section>
        </div>
      </motion.div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  status,
  hint,
}: {
  label: string;
  status: 'connected' | 'info';
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4 border-border-subtle [&:not(:first-child)]:border-t">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {hint && (
          <div className="mt-1 text-xs text-text-secondary">{hint}</div>
        )}
      </div>
      {status === 'connected' && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
          <span className="text-xs text-text-secondary">Connected</span>
        </div>
      )}
    </div>
  );
}
