import { ChatInterface } from '@/components/chat/ChatInterface';
import { IconCompass } from '@/components/ui/Icon';

export default function GraphicsPage() {
  return (
    <ChatInterface
      domain="graphics"
      title="Engineering Graphics"
      subtitle="Projections, conics, curves, sectioning, and more"
      Icon={IconCompass}
    />
  );
}
