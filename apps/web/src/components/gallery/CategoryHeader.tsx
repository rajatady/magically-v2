/**
 * Full-width category header — Apple App Store style.
 * Large background gradient with title + subtitle overlay.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle: string;
  gradient?: string;
  className?: string;
}

const defaultGradients = [
  'from-orange-600/40 via-amber-700/20 to-bg-shell',
  'from-blue-600/40 via-indigo-700/20 to-bg-shell',
  'from-emerald-600/40 via-teal-700/20 to-bg-shell',
  'from-violet-600/40 via-purple-700/20 to-bg-shell',
  'from-rose-600/40 via-pink-700/20 to-bg-shell',
];

export const CategoryHeader = memo(function CategoryHeader({
  title,
  subtitle,
  gradient,
  className,
}: Props) {
  const bg = gradient ?? defaultGradients[Math.abs(hashCode(title)) % defaultGradients.length];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl px-8 py-12',
        'bg-gradient-to-br',
        bg,
        className,
      )}
    >
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          {subtitle}
        </p>
        <h2 className="mt-2 font-serif text-3xl font-normal italic text-text-1">
          {title}
        </h2>
      </div>
    </div>
  );
});

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}
