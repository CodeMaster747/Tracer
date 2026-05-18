/**
 * Modeling helpers — translate physical specifications into transfer functions.
 *
 * Covers:
 *   - Mass-spring-damper systems (translational and rotational)
 *   - RLC electrical circuits (series and parallel)
 *   - Analogous-system translation tables
 *   - DC motor (armature-controlled, field-controlled)
 *   - Servo systems (position-servo with tach feedback)
 */
import type { TransferFunction } from './controlTypes';

/* ---------- Mass–Spring–Damper ---------- */
/**
 *   m·ẍ + b·ẋ + k·x = F(t)
 *   X(s)/F(s) = 1 / (m s² + b s + k)
 */
export function massSpringDamper(m: number, b: number, k: number): TransferFunction {
  return {
    numerator: [1],
    denominator: [m, b, k],
    display: `1 / (${m}s² + ${b}s + ${k})`,
  };
}

/** Rotational analog: J·ω̇ + B·ω = T → Ω(s)/T(s) = 1/(Js + B) */
export function rotationalVelocity(J: number, B: number): TransferFunction {
  return { numerator: [1], denominator: [J, B], display: `1 / (${J}s + ${B})` };
}

/** Rotational position: J·θ̈ + B·θ̇ + K·θ = T */
export function rotationalPosition(J: number, B: number, K: number): TransferFunction {
  return {
    numerator: [1],
    denominator: [J, B, K],
    display: `1 / (${J}s² + ${B}s + ${K})`,
  };
}

/* ---------- RLC circuits ---------- */
/**
 * Series RLC, output across the capacitor:
 *   V_C / V_in = 1 / (LC s² + RC s + 1)
 */
export function rlcSeriesAcrossC(R: number, L: number, C: number): TransferFunction {
  return {
    numerator: [1],
    denominator: [L * C, R * C, 1],
    display: `1 / (${L * C}s² + ${R * C}s + 1)`,
  };
}

/** Output across the inductor */
export function rlcSeriesAcrossL(R: number, L: number, C: number): TransferFunction {
  return {
    numerator: [L * C, 0, 0],
    denominator: [L * C, R * C, 1],
    display: `LCs² / (LCs² + RCs + 1)`,
  };
}

/** Output across the resistor */
export function rlcSeriesAcrossR(R: number, L: number, C: number): TransferFunction {
  return {
    numerator: [0, R * C, 0],
    denominator: [L * C, R * C, 1],
    display: `RCs / (LCs² + RCs + 1)`,
  };
}

/** Parallel RLC: Z(s) = 1 / (1/R + 1/(Ls) + Cs) */
export function rlcParallelImpedance(R: number, L: number, C: number): TransferFunction {
  // Z = LRs / (LCRs² + Ls + R)
  return {
    numerator: [L * R, 0],
    denominator: [L * C * R, L, R],
    display: `LRs / (LCRs² + Ls + R)`,
  };
}

/* ---------- Analogous Systems ---------- */
export interface AnalogousMapping {
  electrical: string;
  forceVoltage: string;   // Mechanical analog (force-voltage)
  forceCurrent: string;   // Mechanical analog (force-current)
}

export const ANALOGOUS_TABLE: AnalogousMapping[] = [
  { electrical: 'Voltage v',          forceVoltage: 'Force F',                forceCurrent: 'Force F' },
  { electrical: 'Current i',          forceVoltage: 'Velocity v',             forceCurrent: 'Velocity v' },
  { electrical: 'Charge q',           forceVoltage: 'Displacement x',         forceCurrent: 'Displacement x' },
  { electrical: 'Inductance L',       forceVoltage: 'Mass M',                 forceCurrent: 'Compliance 1/K' },
  { electrical: 'Resistance R',       forceVoltage: 'Damping B',              forceCurrent: 'Conductance 1/B' },
  { electrical: 'Capacitance C',      forceVoltage: 'Compliance 1/K',         forceCurrent: 'Mass M' },
];

/* ---------- DC motor ---------- */
/**
 * Armature-controlled DC motor (constant field):
 *   V_a = R_a I_a + L_a dI_a/dt + K_b·ω
 *   J·dω/dt + B·ω = K_t·I_a − T_L
 *
 * Output θ(s)/V_a(s):
 *   θ(s)/V_a(s) = K_t / [ s · ((L_a s + R_a)(J s + B) + K_t·K_b) ]
 *
 *   Order = 3 (one extra integrator for angle).
 *   If L_a is small (often the case), this reduces to a 2nd-order TF.
 */
export interface DCMotorParams {
  R_a: number;     // armature resistance (Ω)
  L_a: number;     // armature inductance (H)
  K_t: number;     // torque constant (N·m/A)
  K_b: number;     // back-emf constant (V·s/rad)
  J: number;       // rotor inertia (kg·m²)
  B: number;       // viscous damping (N·m·s/rad)
}

/** θ(s)/V_a(s) for armature-controlled DC motor (position output). */
export function dcMotorPosition(p: DCMotorParams): TransferFunction {
  const { R_a, L_a, K_t, K_b, J, B } = p;
  // Inner: (Ls+R)(Js+B) + KtKb = LJ s² + (LB + RJ) s + (RB + KtKb)
  const a2 = L_a * J;
  const a1 = L_a * B + R_a * J;
  const a0 = R_a * B + K_t * K_b;
  return {
    numerator: [K_t],
    denominator: [a2, a1, a0, 0], // multiply by s for position
    display: `Kt / [ s · ((Ls+R)(Js+B) + KtKb) ]`,
  };
}

/** ω(s)/V_a(s) for armature-controlled DC motor (velocity output). */
export function dcMotorVelocity(p: DCMotorParams): TransferFunction {
  const { R_a, L_a, K_t, K_b, J, B } = p;
  const a2 = L_a * J;
  const a1 = L_a * B + R_a * J;
  const a0 = R_a * B + K_t * K_b;
  return {
    numerator: [K_t],
    denominator: [a2, a1, a0],
    display: `Kt / ((Ls+R)(Js+B) + KtKb)`,
  };
}

/** Field-controlled DC motor (constant armature current): θ(s)/V_f(s) */
export function dcMotorFieldControlled(K_f: number, R_f: number, L_f: number, J: number, B: number): TransferFunction {
  // (Lfs + Rf)(Js + B) s in denominator (with one extra integrator for angle)
  // Num = Kf
  const lj = L_f * J;
  const lj_b = L_f * B + R_f * J;
  const rb = R_f * B;
  return {
    numerator: [K_f],
    denominator: [lj, lj_b, rb, 0],
    display: `Kf / [ s·(Lfs+Rf)(Js+B) ]`,
  };
}

/* ---------- Servo system ---------- */
/**
 * Standard position servo with unity feedback and a DC motor:
 *   C(s)/R(s) = Kₐ·Gmotor·G_amp(s) / (1 + Kₐ·Gmotor·G_amp(s)·Hfb)
 *
 * Returns the open-loop TF; closed-loop is computed by feedback().
 */
export function positionServoOpenLoop(motor: TransferFunction, K_amp: number): TransferFunction {
  return {
    numerator: motor.numerator.map((v) => v * K_amp),
    denominator: motor.denominator.slice(),
    display: `${K_amp} · ${motor.display}`,
  };
}
