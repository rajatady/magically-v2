import { memo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  src?: string | null;
  alt: string;
  fallbackEmoji?: string;
  className?: string;
}

export const AgentImage = memo(function AgentImage({ src, alt, fallbackEmoji = '🤖', className }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center', className)} aria-label={alt}>
        <span className="text-3xl">{fallbackEmoji}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
});
