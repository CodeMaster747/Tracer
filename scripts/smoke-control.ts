/**
 * Smoke test for the Control Systems engine — wide topic coverage.
 *   npx tsx scripts/smoke-control.ts
 */
import { solveControlQuestion } from '../src/engines/control';

const cases: { q: string; expectSuccess?: boolean; tag?: string }[] = [
  // Existing baseline
  { q: 'Pole-zero plot for G(s) = (s+2) / ((s+1)(s+3))' },
  { q: 'Routh-Hurwitz stability for s^4 + 2s^3 + 3s^2 + 4s + 5' },
  { q: 'Bode plot for G(s) = 10 / (s^2 + 2s + 10)' },
  { q: 'Routh-Hurwitz check for G(s) = 1 / (s^3 + 2s^2 + 3s + 1)' },
  { q: 'Pole-zero plot of (s^2 + 2s + 5) / (s^3 + 6s^2 + 11s + 6)' },

  // Time response
  { q: 'Step response of G(s) = 25 / (s^2 + 4s + 25)', tag: '2nd order step' },
  { q: 'Impulse response of G(s) = 1 / (s + 1)', tag: '1st order impulse' },
  { q: 'Ramp response of G(s) = 10 / (s^2 + 2s + 10)', tag: 'ramp' },

  // Stability / margins
  { q: 'Calculate the gain margin of G(s) = 10 / (s(s+1)(s+10))' },
  { q: 'Phase margin of G(s) = 100 / ((s+1)(s+5)(s+20))' },

  // Root locus
  { q: 'Root locus of G(s)H(s) = K / (s(s+2)(s+5))' },

  // Nyquist + Polar
  { q: 'Nyquist plot of G(s) = 10 / (s(s+1)(s+5))' },
  { q: 'Polar plot of G(s) = 1 / (s+1)' },

  // State-space conversion
  { q: 'TF to state space for G(s) = (s+1) / (s^2 + 3s + 2)' },
  { q: 'State space to TF: A=[[0,1],[-2,-3]]; B=[[0],[1]]; C=[[1,0]]; D=[[0]]' },

  // Controllability & observability
  { q: 'Controllability A=[[0,1],[-2,-3]]; B=[[0],[1]]; C=[[1,0]]; D=[[0]]' },
  { q: 'Observability A=[[0,1],[-2,-3]]; B=[[0],[1]]; C=[[1,0]]; D=[[0]]' },

  // State transition matrix
  { q: 'State transition matrix A=[[0,1],[-2,-3]]; B=[[0],[1]]; C=[[1,0]]; D=[[0]] at t = 0.5' },

  // Block diagram reduction
  { q: 'Block diagram reduction:\nG1 = 1/(s+1)\nG2 = 10/(s+5)\nH = 1\nseries: G1, G2\nnegative feedback STEP1 over H' },

  // SFG / Mason
  { q: 'Signal flow graph:\nX1 -> X2 : a\nX2 -> X3 : b\nX3 -> X2 : -c\ninput: X1\noutput: X3\na = 2, b = 3, c = 1' },

  // Feedback
  { q: 'Feedback system: G(s) = 1 / (s(s+2)), K = 5' },

  // PID and compensators
  { q: 'PID controller with Kp=2, Ki=1, Kd=0.5' },
  { q: 'PI controller Kp=2, Ki=4' },
  { q: 'PD controller Kp=3, Kd=0.2' },
  { q: 'Lead compensator with phi=45, omega=10' },
  { q: 'Lag compensator beta=10, omega=1' },
  { q: 'Lead-lag compensator phi=30, wm=10, beta=8, wp=0.5' },

  // Modeling
  { q: 'Mass-spring-damper system m=1, b=2, k=5' },
  { q: 'RLC circuit R=10, L=0.1, C=0.001' },
  { q: 'DC motor model Ra=1, La=0.5, Kt=0.1, Kb=0.1, J=0.01, B=0.1' },
  { q: 'Servo system Ra=1, La=0.5, Kt=0.1, Kb=0.1, J=0.01, B=0.1, Ka=10' },
  { q: 'Analogous systems table' },

  // Refusal cases
  { q: 'Calculate the gain margin', expectSuccess: false },
  { q: 'Explain how the loop works', expectSuccess: false },
];

let passes = 0, fails = 0;
for (const c of cases) {
  const r = solveControlQuestion(c.q);
  const expected = c.expectSuccess !== false;
  const tag = c.tag ? ` [${c.tag}]` : '';
  if (r.success === expected) {
    passes++;
    console.log(`OK  | ${c.q.slice(0, 70)}${tag}`);
    if (r.success) {
      console.log(`    summary: ${r.summary.slice(0, 150)}`);
      console.log(`    strokes: ${r.strokes.length}, paper: ${r.paper.size} ${r.paper.orientation}`);
    } else {
      console.log(`    refusal: ${r.refusalReason?.slice(0, 120)}`);
    }
  } else {
    fails++;
    console.log(`FAIL| ${c.q.slice(0, 70)}${tag}`);
    if (r.success) console.log(`    unexpected success — summary: ${r.summary.slice(0, 120)}`);
    else console.log(`    unexpected refusal — ${r.refusalReason?.slice(0, 120)}`);
  }
  console.log();
}
console.log(`\n=== ${passes}/${cases.length} passed, ${fails} failed ===`);
