import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';

const MODULES: [string, string, string][] = [
  ['01', 'Engineering Graphics', 'projection · conics · isometric'],
  ['02', 'Automata Theory', 'DFA · NFA · Thompson'],
  ['03', 'Control Systems', 'pole-zero · Routh · Bode'],
];

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Shared chrome for sign in / sign up: an editorial field on the left carrying
 * the statement and the module index, the form on the right. The left panel
 * drops away below lg so the form gets the full width on small screens.
 */
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex h-full overflow-hidden bg-bg-primary">
      {/* Editorial field */}
      <div className="relative hidden h-full shrink-0 basis-[56%] flex-col overflow-hidden px-16 py-16 lg:flex">
        <ConstructionSpecimen />

        <div className="relative">
          <Logo withText size={26} />
        </div>

        <div className="flex-1" />

        <div className="relative max-w-[560px]">
          <div className="u-label">Constructed, not rendered</div>
          <h1 className="mt-6 font-display text-[46px] font-normal leading-[1.14] tracking-tight text-balance">
            Every construction, in the order a draughtsman would draw it.
          </h1>
          <p className="mt-6 max-w-[440px] text-sm leading-relaxed text-text-secondary">
            Stroke order is preserved end to end — every arc, locus and
            projector replayed step by step, exactly as it was constructed.
          </p>
        </div>

        <div className="flex-1" />

        <div className="relative z-10 max-w-[560px] border-t border-border-subtle bg-bg-primary">
          {MODULES.map(([n, name, detail], i) => (
            <div
              key={n}
              className={
                'flex items-baseline gap-4 py-3' +
                (i < MODULES.length - 1 ? ' border-b border-border-subtle' : '')
              }
            >
              <span className="w-6 font-mono text-[10px] tabular-nums tracking-[0.14em] text-text-dim">
                {n}
              </span>
              <span className="text-[13px] font-medium">{name}</span>
              <span className="ml-auto font-mono text-[11px] text-text-muted">
                {detail}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="flex h-full flex-1 flex-col items-center justify-center overflow-y-auto border-l border-border-subtle bg-bg-secondary px-6 py-12 sm:px-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="w-full max-w-[384px]"
        >
          <div className="mb-8 lg:hidden">
            <Logo withText size={24} />
          </div>

          <h2 className="font-display text-[31px] font-normal tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
            {subtitle}
          </p>

          <div className="mt-8">{children}</div>

          <div className="mt-7 border-t border-border-subtle pt-5 text-[12.5px] text-text-secondary">
            {footer}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** The ellipse construction from the workspace, drawn faint and bled off-frame. */
function ConstructionSpecimen() {
  return (
    <svg
      width="720"
      height="720"
      viewBox="0 0 720 720"
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-72 -right-56 opacity-50"
    >
      <g fill="none" stroke="#d4d8de" strokeWidth="1">
        <circle cx="360" cy="360" r="250" />
        <circle cx="360" cy="360" r="147" />
      </g>
      <g fill="none" stroke="#e5e7eb" strokeWidth="1">
        <path d="M360 60 V660 M60 360 H660" />
        <path d="M360 360 L601.5 490 M360 360 L490 118.5 M360 360 L118.5 230 M360 360 L230 601.5" />
        <path d="M601.5 490 V438.5 M490 118.5 V269.5 M118.5 230 V281.5 M230 601.5 V450.5" />
      </g>
      <ellipse
        cx="360"
        cy="360"
        rx="250"
        ry="147"
        fill="none"
        stroke="#c2c8d1"
        strokeWidth="1.6"
      />
    </svg>
  );
}
