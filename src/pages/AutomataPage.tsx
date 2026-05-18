import { ChatInterface } from '@/components/chat/ChatInterface';
import { IconAutomata } from '@/components/ui/Icon';

export default function AutomataPage() {
  return (
    <ChatInterface
      domain="automata"
      title="Automata Theory"
      subtitle="DFA, NFA, regex, CFG, PDA, Turing machines"
      Icon={IconAutomata}
    />
  );
}
