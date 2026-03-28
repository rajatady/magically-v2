/**
 * Custom image wrapper — controls loading, fallback, and future CDN switching.
 * All agent images go through this component.
 */
import { memo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  src?: string | null;
  alt: string;
  fallbackEmoji?: string;
  className?: string;
  aspectRatio?: 'square' | '4/3' | '16/9';
}

export const AgentImage = memo(function AgentImage({
  src,
  alt,
  fallbackEmoji = '🤖',
  className,
  aspectRatio = 'square',
}: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  const ratioClass = {
    square: 'aspect-square',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-video',
  }[aspectRatio];

  if (showFallback) {
    return (
      <div
        className={cn(
          ratioClass,
          'flex items-center justify-center rounded-2xl bg-gradient-to-br from-bg-card to-bg-hover',
          className,
        )}
        aria-label={alt}
      >
        <span className="text-4xl">{fallbackEmoji}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(ratioClass, 'rounded-2xl object-cover', className)}
    />
  );
});
