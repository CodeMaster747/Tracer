/**
 * Workspace contract.
 *
 * BaseCanvasShell renders the shared chrome (top bar, side frames, viewport,
 * playback clock). A WorkspaceModule plugs into that chrome to provide the
 * subject-specific sidebar, inspector, toolbar slots, and canvas content.
 *
 * The shell never references 'graphics' / 'automata' / 'control' by name —
 * the registry resolves a SolvedQuestion's domain to its module.
 */

import type { FC, ReactNode } from 'react';
import type { Domain, SolvedQuestion } from '@/engines/types';

/** Logical viewport configuration the module exposes to the base viewport. */
export interface ModuleViewport {
  /** Logical content width in user units (e.g. mm for graphics). */
  widthUnits: number;
  /** Logical content height in user units. */
  heightUnits: number;
  /** Multiplier applied to the SVG transform. Graphics uses 3 (mm × 3 → px). */
  unitScale?: number;
  /** Fill behind the SVG content. Graphics: '#ffffff'. Others: transparent. */
  background?: string;
  /** Whether to render a 1px paper edge around the content surface. */
  showPaperEdge?: boolean;
}

/** Discriminated selection — extended as new modules land. */
export type Selection =
  | null
  | { kind: 'stroke'; id: string }
  | { kind: 'state'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'block'; id: string };

/** Context passed to every module-rendered slot. */
export interface WorkspaceContext {
  question: SolvedQuestion;
  /** Replace the in-memory question (e.g. paper change). */
  updateQuestion: (next: SolvedQuestion) => void;
  /** Current playback step (0 = nothing drawn). */
  currentStep: number;
  /** Total step count for this question (module-defined). */
  totalSteps: number;
  /** Programmatic step setter — used when a sidebar row navigates the canvas. */
  setStep: (n: number) => void;
  /** Hovered element under the cursor (driven by canvas + sidebars). */
  hovered: Selection;
  setHovered: (s: Selection) => void;
  /** Persistent selection (click to pin). */
  selection: Selection;
  setSelection: (s: Selection) => void;
}

/** Props for module slot components. */
export interface ModuleSlotProps {
  ctx: WorkspaceContext;
}

/** A discoverable action exposed in the command palette. */
export interface Command {
  id: string;
  /** Primary search target. */
  label: string;
  /** Optional supplementary text shown after the label. */
  hint?: string;
  /** Section header in the palette list. */
  group: string;
  /** Optional small glyph identifier (interpreted by the palette). */
  icon?: 'step' | 'plot' | 'convert' | 'view' | 'export' | 'doc';
  action: (ctx: WorkspaceContext) => void | Promise<void>;
}

/** The contract every subject-specific workspace must implement. */
export interface WorkspaceModule {
  id: Domain;
  displayName: string;
  /** Muted accent used for active selection rings, 1px highlights. */
  accent: { hex: string; label: string };

  /** Module-owned viewport spec (may depend on the question). */
  getViewport: (q: SolvedQuestion) => ModuleViewport;
  /** Step count exposed to the playback clock. */
  getTotalSteps: (q: SolvedQuestion) => number;
  /** Sub-label rendered next to the title in the top bar. */
  getMetaLine?: (q: SolvedQuestion) => string;
  /** Filename used by export (default: question.title). */
  getExportName?: (q: SolvedQuestion) => string;

  /** Left sidebar. */
  LeftSidebar: FC<ModuleSlotProps>;
  /** Right inspector / analysis pane. */
  RightInspector: FC<ModuleSlotProps>;
  /** Optional toolbar items injected next to title (e.g. paper picker). */
  ToolbarSlots?: FC<ModuleSlotProps>;
  /** SVG children rendered inside the viewport at unit coordinates. */
  CanvasContent: FC<ModuleSlotProps>;
  /** Module-contributed commands exposed in the command palette. */
  getCommands?: (ctx: WorkspaceContext) => Command[];
}

/** Convenience to wrap a single child as a slot. */
export type SlotChildren = { children?: ReactNode };
