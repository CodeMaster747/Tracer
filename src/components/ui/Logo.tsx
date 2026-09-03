import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
}

export function Logo({ size = 24, className, withText = false }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="3"
          fill="#ffffff"
          stroke="#d4d8de"
        />
        <path
          d="M8 22 L16 8 L24 22 M11 17 H21"
          stroke="#14171a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="16" cy="8" r="1.6" fill="#14171a" />
      </svg>
      {withText && (
        <span className="font-display text-[17px] font-medium tracking-tight text-text-primary">
          Tracer
        </span>
      )}
    </div>
  );
}
