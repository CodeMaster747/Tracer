import { ChatInterface } from '@/components/chat/ChatInterface';
import { IconControl } from '@/components/ui/Icon';

export default function ControlPage() {
  return (
    <ChatInterface
      domain="control"
      title="Control Systems"
      subtitle="Transfer functions, root locus, Bode, Nyquist, stability"
      Icon={IconControl}
    />
  );
}
