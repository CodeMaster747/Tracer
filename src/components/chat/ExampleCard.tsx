import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { IconEye, IconBookmark } from '@/components/ui/Icon';

interface Props {
  title: string;
  onView: () => void;
  onSave: () => void;
}

export function ExampleCard({ title, onView, onSave }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-xl border border-border-subtle bg-bg-secondary p-5 transition-colors duration-150 hover:border-border-default"
    >
      <h3 className="mb-4 text-sm font-medium leading-snug text-text-primary line-clamp-2">
        {title}
      </h3>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={onView}
          leftIcon={<IconEye className="h-3.5 w-3.5" />}
        >
          Open
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onSave}
          leftIcon={<IconBookmark className="h-3.5 w-3.5" />}
        >
          Save
        </Button>
      </div>
    </motion.div>
  );
}
