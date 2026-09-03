import { useRef, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const goRegister = () => navigate('/signup');

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto overflow-x-hidden bg-bg-primary text-text-primary"
    >
      <TopNav onStart={goRegister} />

      <Hero onStart={goRegister} />

      <HowItWorks />

      <ShowcaseSection
        scrollRef={scrollRef}
        index={1}
        align="left"
        eyebrow="01 / Module"
        title="Engineering Graphics"
        description="Project points, lines, conics, and isometric solids with verified stroke order. Construction lines are preserved — every arc, locus, and projector is replayed in the exact sequence a draughtsman would draw."
        bullets={[
          'First and third angle projection',
          'Conics, cycloidals, involutes',
          'Isometric primitives & construction',
        ]}
        visual={<GraphicsVisual />}
      />

      <ShowcaseSection
        scrollRef={scrollRef}
        index={2}
        align="right"
        eyebrow="02 / Module"
        title="Automata Theory"
        description="Construct DFAs and NFAs from formal specifications, convert NFA to DFA via subset construction, and compile regular expressions through Thompson's algorithm — rendered as a clean, navigable state diagram."
        bullets={[
          'DFA / NFA construction',
          'Subset construction & determinisation',
          'Regex via Thompson NFA',
        ]}
        visual={<AutomataVisual />}
      />

      <ShowcaseSection
        scrollRef={scrollRef}
        index={3}
        align="left"
        eyebrow="03 / Module"
        title="Control Systems"
        description="Parse transfer functions in factored or expanded form, then read pole-zero geometry, Routh stability, and Bode response on log-frequency axes — each computed deterministically from the polynomial roots."
        bullets={[
          'Transfer function parser',
          'Pole-zero & Routh-Hurwitz',
          'Bode magnitude / phase plots',
        ]}
        visual={<ControlVisual />}
      />

      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Top navigation                                                         */
/* ---------------------------------------------------------------------- */

function TopNav({ onStart }: { onStart: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/[0.10] bg-bg-primary/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <Logo size={22} />
          <span className="font-display text-[16px] font-medium tracking-tight">
            Tracer
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] text-text-secondary md:flex">
          <a
            href="#modules"
            className="transition-colors duration-150 hover:text-text-primary"
          >
            Modules
          </a>
          <a
            href="#workflow"
            className="transition-colors duration-150 hover:text-text-primary"
          >
            Workflow
          </a>
          <Link
            to="/login"
            className="transition-colors duration-150 hover:text-text-primary"
          >
            Sign in
          </Link>
        </nav>
        <button
          onClick={onStart}
          className="inline-flex h-8 items-center rounded-lg border border-ink/[0.13] bg-ink/[0.04] px-3.5 text-[13px] font-medium text-text-primary transition-colors duration-150 hover:border-ink/[0.22] hover:bg-ink/[0.07]"
        >
          Start engineering
        </button>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero                                                                   */
/* ---------------------------------------------------------------------- */

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-ink/[0.10]">
      <BackgroundGrid />
      <div className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[480px] max-w-5xl bg-[radial-gradient(ellipse_at_center,_rgba(43,85,192,0.06),_transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-ink/[0.13] bg-ink/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-text-secondary"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          Deterministic engine — no AI guesswork
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="max-w-4xl text-balance font-display text-[44px] font-normal leading-[1.08] tracking-[-0.02em] text-text-primary sm:text-[54px] lg:text-[64px]"
        >
          A precision workspace for engineering problems.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 max-w-2xl text-balance text-[15px] leading-relaxed text-text-secondary sm:text-base"
        >
          Tracer solves Engineering Graphics, Automata Theory, and Control
          Systems problems with rule-based engines and stroke-by-stroke
          replay. Built for students and engineers who need verifiable work,
          not plausible answers.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <button
            onClick={onStart}
            className="group inline-flex h-11 items-center gap-2 rounded-lg bg-accent-primary px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-secondary"
          >
            Start engineering
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            >
              <path
                d="M2 7h10M8 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            v0.1 · Build 2026.05
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28 }}
          className="mt-20"
        >
          <HeroSchematic />
        </motion.div>
      </div>
    </section>
  );
}

function HeroSchematic() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-ink/[0.10] bg-bg-secondary">
      <div className="grid grid-cols-3 divide-x divide-ink/[0.10] text-[10.5px] font-mono uppercase tracking-[0.12em] text-text-muted">
        <div className="px-5 py-3">Graphics · Engine</div>
        <div className="px-5 py-3">Automata · Engine</div>
        <div className="px-5 py-3">Control · Engine</div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-ink/[0.10] border-t border-ink/[0.10]">
        <div className="aspect-[5/3] p-4">
          <GraphicsVisual compact />
        </div>
        <div className="aspect-[5/3] p-4">
          <AutomataVisual compact />
        </div>
        <div className="aspect-[5/3] p-4">
          <ControlVisual compact />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* How it works                                                           */
/* ---------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      id: '01',
      title: 'Problem Input',
      body: 'Describe the problem in natural notation. Parsers extract domain primitives — points, quadrants, regex tokens, polynomial coefficients.',
      icon: <IconInput />,
    },
    {
      id: '02',
      title: 'Processing & Analysis',
      body: 'Rule-based engines resolve geometry, run subset construction, or factor polynomials. No language model is involved.',
      icon: <IconProcess />,
    },
    {
      id: '03',
      title: 'Output Visualisation',
      body: 'Results are emitted as ordered strokes and replayed on a deterministic SVG canvas. Export to PDF or PNG when finished.',
      icon: <IconOutput />,
    },
  ];

  return (
    <section
      id="workflow"
      className="relative border-b border-ink/[0.10] py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="mt-3 max-w-2xl text-balance font-display text-[32px] font-normal tracking-tight text-text-primary sm:text-[40px]">
          Three stages from raw question to verified drawing.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-[15px] leading-relaxed text-text-secondary">
          A single linear pipeline runs every problem — there are no hidden
          branches, no probabilistic shortcuts, no hallucinated geometry.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink/[0.10] bg-ink/[0.06] md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.id}
              className="bg-bg-primary p-8 transition-colors duration-150 hover:bg-bg-secondary"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/[0.13] bg-ink/[0.03] text-text-secondary">
                  {s.icon}
                </div>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
                  Step {s.id}
                </span>
              </div>
              <h3 className="mt-8 font-display text-[20px] font-medium tracking-tight text-text-primary">
                {s.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Showcase                                                               */
/* ---------------------------------------------------------------------- */

interface ShowcaseProps {
  scrollRef: RefObject<HTMLDivElement>;
  index: number;
  align: 'left' | 'right';
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: ReactNode;
}

function ShowcaseSection({
  scrollRef,
  index,
  align,
  eyebrow,
  title,
  description,
  bullets,
  visual,
}: ShowcaseProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollRef,
    offset: ['start end', 'end start'],
  });

  const tilt: MotionValue<number> = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    align === 'left' ? [6, 0, -6] : [-6, 0, 6]
  );
  const yShift = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.15, 0.85, 1],
    [0.5, 1, 1, 0.5]
  );

  return (
    <section
      ref={sectionRef}
      id={index === 1 ? 'modules' : undefined}
      className="relative border-b border-ink/[0.10] py-24 lg:py-32"
    >
      <BackgroundGrid faint />
      <div
        className={cn(
          'relative mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-12 lg:gap-16 lg:px-10'
        )}
      >
        <motion.div
          style={{ opacity }}
          className={cn(
            'lg:col-span-5',
            align === 'right' ? 'lg:order-2' : 'lg:order-1'
          )}
        >
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="mt-3 text-balance font-display text-[32px] font-normal leading-tight tracking-tight text-text-primary sm:text-[40px] lg:text-[46px]">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-text-secondary">
            {description}
          </p>
          <ul className="mt-8 space-y-3">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 text-[13.5px] text-text-secondary"
              >
                <span className="mt-[9px] h-px w-4 bg-ink/20" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          style={{ y: yShift }}
          className={cn(
            'lg:col-span-7',
            align === 'right' ? 'lg:order-1' : 'lg:order-2'
          )}
        >
          <TiltedCard tilt={tilt} align={align}>
            {visual}
          </TiltedCard>
        </motion.div>
      </div>
    </section>
  );
}

function TiltedCard({
  children,
  tilt,
  align,
}: {
  children: ReactNode;
  tilt: MotionValue<number>;
  align: 'left' | 'right';
}) {
  return (
    <div
      className="relative"
      style={{ perspective: '1600px' }}
    >
      <motion.div
        style={{
          rotateY: tilt,
          rotateX: 2,
          transformStyle: 'preserve-3d',
          transformOrigin: align === 'left' ? '100% 50%' : '0% 50%',
        }}
        className="relative overflow-hidden rounded-xl border border-ink/[0.13] bg-bg-secondary"
      >
        <div className="flex h-9 items-center gap-2 border-b border-ink/[0.10] bg-bg-tertiary/40 px-4">
          <span className="h-2 w-2 rounded-full bg-ink/[0.08]" />
          <span className="h-2 w-2 rounded-full bg-ink/[0.08]" />
          <span className="h-2 w-2 rounded-full bg-ink/[0.08]" />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
            tracer · canvas
          </span>
        </div>
        <div className="aspect-[16/10] p-6 lg:p-8">{children}</div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Visuals — inline SVG technical illustrations                            */
/* ---------------------------------------------------------------------- */

function GraphicsVisual({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 250"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern
          id="g-grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(20,23,26,0.05)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="400" height="250" fill="url(#g-grid)" />

      <line
        x1="0"
        y1="125"
        x2="400"
        y2="125"
        stroke="rgba(20,23,26,0.2)"
        strokeWidth="0.8"
        strokeDasharray="4 4"
      />
      <text
        x="380"
        y="120"
        fill="rgba(20,23,26,0.4)"
        fontSize="9"
        fontFamily="JetBrains Mono, monospace"
        textAnchor="end"
      >
        XY
      </text>

      {/* Isometric cube construction */}
      <g
        stroke="rgba(20,23,26,0.85)"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="200,55 270,90 270,170 200,205 130,170 130,90" />
        <line x1="200" y1="55" x2="200" y2="135" />
        <line x1="130" y1="90" x2="200" y2="135" />
        <line x1="270" y1="90" x2="200" y2="135" />
        <line x1="200" y1="135" x2="200" y2="205" />
      </g>

      {/* Construction projectors */}
      <g
        stroke="rgba(20,23,26,0.25)"
        strokeWidth="0.6"
        strokeDasharray="3 3"
      >
        <line x1="200" y1="55" x2="200" y2="20" />
        <line x1="270" y1="90" x2="320" y2="60" />
        <line x1="130" y1="90" x2="80" y2="60" />
        <line x1="200" y1="205" x2="200" y2="235" />
      </g>

      {/* Dimension marks */}
      {!compact && (
        <g
          stroke="rgba(20,23,26,0.4)"
          strokeWidth="0.6"
          fill="rgba(20,23,26,0.55)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          <line x1="40" y1="90" x2="40" y2="170" />
          <line x1="36" y1="90" x2="44" y2="90" />
          <line x1="36" y1="170" x2="44" y2="170" />
          <text x="50" y="134">
            80
          </text>

          <line x1="130" y1="225" x2="270" y2="225" />
          <line x1="130" y1="221" x2="130" y2="229" />
          <line x1="270" y1="221" x2="270" y2="229" />
          <text x="195" y="240">140</text>
        </g>
      )}

      {/* Vertex markers */}
      <g fill="rgba(20,23,26,0.95)">
        {[
          [200, 55],
          [270, 90],
          [270, 170],
          [200, 205],
          [130, 170],
          [130, 90],
          [200, 135],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" />
        ))}
      </g>
    </svg>
  );
}

function AutomataVisual({ compact = false }: { compact?: boolean }) {
  const states = [
    { id: 'q0', x: 70, y: 125, accepting: false, start: true },
    { id: 'q1', x: 200, y: 80, accepting: false, start: false },
    { id: 'q2', x: 200, y: 170, accepting: false, start: false },
    { id: 'q3', x: 330, y: 125, accepting: true, start: false },
  ];

  return (
    <svg viewBox="0 0 400 250" className="h-full w-full">
      <defs>
        <pattern
          id="a-grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(20,23,26,0.04)"
            strokeWidth="0.5"
          />
        </pattern>
        <marker
          id="arr"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(20,23,26,0.8)" />
        </marker>
      </defs>
      <rect width="400" height="250" fill="url(#a-grid)" />

      {/* Start arrow */}
      <line
        x1="25"
        y1="125"
        x2="48"
        y2="125"
        stroke="rgba(20,23,26,0.8)"
        strokeWidth="1.1"
        markerEnd="url(#arr)"
      />

      {/* Transitions */}
      <g
        stroke="rgba(20,23,26,0.75)"
        strokeWidth="1.1"
        fill="none"
      >
        <path d="M 90 115 Q 135 80 180 88" markerEnd="url(#arr)" />
        <path d="M 90 135 Q 135 170 180 162" markerEnd="url(#arr)" />
        <path d="M 220 80 Q 275 80 312 113" markerEnd="url(#arr)" />
        <path d="M 220 170 Q 275 170 312 137" markerEnd="url(#arr)" />
        <path d="M 200 102 Q 225 125 200 148" markerEnd="url(#arr)" />
      </g>

      {/* Transition labels */}
      {!compact && (
        <g
          fill="rgba(20,23,26,0.6)"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
        >
          <text x="125" y="85">0</text>
          <text x="125" y="180">1</text>
          <text x="270" y="80">1</text>
          <text x="270" y="180">0</text>
          <text x="232" y="129">ε</text>
        </g>
      )}

      {/* States */}
      {states.map((s) => (
        <g key={s.id}>
          <circle
            cx={s.x}
            cy={s.y}
            r="22"
            fill="#ffffff"
            stroke="rgba(20,23,26,0.85)"
            strokeWidth="1.2"
          />
          {s.accepting && (
            <circle
              cx={s.x}
              cy={s.y}
              r="17"
              fill="none"
              stroke="rgba(20,23,26,0.85)"
              strokeWidth="1.2"
            />
          )}
          <text
            x={s.x}
            y={s.y + 4}
            fill="rgba(20,23,26,0.95)"
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
          >
            {s.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ControlVisual({ compact = false }: { compact?: boolean }) {
  // Bode magnitude curve points: low-frequency flat, -20 dB/dec roll-off.
  const points = Array.from({ length: 60 }, (_, i) => {
    const x = 40 + (i / 59) * 320;
    const wRel = i / 59;
    const dB = wRel < 0.45 ? -2 - wRel * 6 : -5 - (wRel - 0.45) * 60;
    const y = 60 - dB * 1.6;
    return `${x},${y}`;
  }).join(' ');

  const phasePoints = Array.from({ length: 60 }, (_, i) => {
    const x = 40 + (i / 59) * 320;
    const wRel = i / 59;
    const phase = -10 - wRel * 80;
    const y = 170 - phase * 0.5;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 400 250" className="h-full w-full">
      <defs>
        <pattern
          id="c-grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(20,23,26,0.04)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="400" height="250" fill="url(#c-grid)" />

      {/* Magnitude plot axes */}
      <g
        stroke="rgba(20,23,26,0.3)"
        strokeWidth="0.8"
        fill="none"
      >
        <line x1="40" y1="20" x2="40" y2="115" />
        <line x1="40" y1="115" x2="370" y2="115" />
        <line x1="40" y1="130" x2="40" y2="225" />
        <line x1="40" y1="225" x2="370" y2="225" />
      </g>

      {/* Labels */}
      {!compact && (
        <g
          fill="rgba(20,23,26,0.5)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          <text x="42" y="16">|G(jω)| dB</text>
          <text x="42" y="126">∠G(jω)°</text>
          <text x="360" y="240" textAnchor="end">log ω</text>
        </g>
      )}

      {/* Magnitude curve */}
      <polyline
        points={points}
        fill="none"
        stroke="rgba(20,23,26,0.9)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Asymptote */}
      <line
        x1="40"
        y1="68"
        x2="200"
        y2="68"
        stroke="rgba(20,23,26,0.3)"
        strokeWidth="0.8"
        strokeDasharray="3 3"
      />
      <line
        x1="200"
        y1="68"
        x2="360"
        y2="108"
        stroke="rgba(20,23,26,0.3)"
        strokeWidth="0.8"
        strokeDasharray="3 3"
      />

      {/* Phase curve */}
      <polyline
        points={phasePoints}
        fill="none"
        stroke="rgba(20,23,26,0.9)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Corner frequency marker */}
      <line
        x1="200"
        y1="20"
        x2="200"
        y2="225"
        stroke="rgba(20,23,26,0.15)"
        strokeWidth="0.6"
        strokeDasharray="2 4"
      />
      {!compact && (
        <text
          x="204"
          y="30"
          fill="rgba(20,23,26,0.5)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          ωc
        </text>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Footer                                                                 */
/* ---------------------------------------------------------------------- */

function Footer() {
  const columns = [
    {
      title: 'Get Support',
      links: [
        ['Help Centre', '#'],
        ['Report an Issue', '#'],
        ['System Status', '#'],
        ['Engine Coverage', '#'],
      ],
    },
    {
      title: 'Learn to Use',
      links: [
        ['Getting Started', '#'],
        ['Graphics Walkthrough', '#'],
        ['Automata Reference', '#'],
        ['Control Systems Guide', '#'],
        ['Keyboard Shortcuts', '#'],
      ],
    },
    {
      title: 'Contact Us',
      links: [
        ['hello@tracer.app', 'mailto:hello@tracer.app'],
        ['Press & Media', '#'],
        ['Academic Partners', '#'],
        ['Careers', '#'],
      ],
    },
  ];

  return (
    <footer className="border-t border-ink/[0.10] bg-bg-primary">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:px-10">
        <div className="sm:col-span-2 lg:col-span-6">
          <Logo size={22} />
          <p className="mt-5 max-w-xs text-[13.5px] leading-relaxed text-text-secondary">
            A deterministic engineering workspace for graphics, automata, and
            control systems. Built for verifiable work.
          </p>
          <div className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
            Build 2026.05 · v0.1
          </div>
        </div>

        {columns.map((c) => (
          <div key={c.title} className="lg:col-span-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary">
              {c.title}
            </h4>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-[13.5px] text-text-secondary transition-colors duration-150 hover:text-text-primary"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink/[0.10]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-5 text-xs text-text-muted lg:flex-row lg:items-center lg:px-10">
          <div>© 2026 Tracer. Engineering, traced.</div>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="transition-colors duration-150 hover:text-text-primary"
            >
              Privacy
            </a>
            <a
              href="#"
              className="transition-colors duration-150 hover:text-text-primary"
            >
              Terms
            </a>
            <a
              href="#"
              className="transition-colors duration-150 hover:text-text-primary"
            >
              Acknowledgements
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared bits                                                            */
/* ---------------------------------------------------------------------- */

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
      {children}
    </div>
  );
}

function BackgroundGrid({ faint = false }: { faint?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0',
        faint ? 'opacity-40' : 'opacity-100'
      )}
      style={{
        backgroundImage:
          'linear-gradient(rgba(20,23,26,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(20,23,26,0.035) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage:
          'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, transparent 80%)',
        WebkitMaskImage:
          'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, transparent 80%)',
      }}
    />
  );
}

function IconInput() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5"
        y="6.5"
        width="17"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7 12h7M7 9h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function IconProcess() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M9 10v4M12 9v6M15 11v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M3 12h3M18 12h3M12 3v3M12 18v3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconOutput() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 18V8l5-3 6 4 5-2v10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9" cy="5" r="1.4" fill="currentColor" />
      <circle cx="15" cy="9" r="1.4" fill="currentColor" />
      <circle cx="20" cy="7" r="1.4" fill="currentColor" />
    </svg>
  );
}
