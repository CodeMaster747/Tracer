import type { ComponentType, SVGProps } from 'react';
import type { Domain } from '@/engines/types';
import { IconCompass, IconAutomata, IconControl } from '@/components/ui/Icon';

/** Per-module label, glyph and accent. One lightness/chroma, three hues. */
export const DOMAIN_META: Record<
  Domain,
  { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }
> = {
  graphics: { label: 'Graphics', Icon: IconCompass, tone: '#2b55c0' },
  automata: { label: 'Automata', Icon: IconAutomata, tone: '#1c6b84' },
  control: { label: 'Control', Icon: IconControl, tone: '#177a4c' },
};

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
