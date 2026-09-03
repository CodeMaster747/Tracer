import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Standard content page: display-serif title over a hairline-ruled body. */
export function PageShell({ title, subtitle, children }: Props) {
  return (
    <div className="h-full overflow-y-auto bg-bg-primary">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-[1000px] px-16 py-14"
      >
        <header className="mb-7">
          <h1 className="font-display text-[33px] font-normal tracking-tight">
            {title}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-text-secondary">{subtitle}</p>
        </header>
        {children}
      </motion.div>
    </div>
  );
}
