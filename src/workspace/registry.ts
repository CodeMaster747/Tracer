import type { Domain } from '@/engines/types';
import type { WorkspaceModule } from './types';
import { DraftingModule } from './modules/graphics';
import { StateMachineModule } from './modules/automata';
import { SystemsModule } from './modules/control';

/** Domain → workspace module. */
const REGISTRY: Record<Domain, WorkspaceModule> = {
  graphics: DraftingModule,
  automata: StateMachineModule,
  control: SystemsModule,
};

export function resolveModule(domain: Domain): WorkspaceModule {
  return REGISTRY[domain] ?? DraftingModule;
}
