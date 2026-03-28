/**
 * Agent card — Dreamer-inspired. No hard borders. The gradient IS the card's identity.
 * Draft cards have a translucent, blueprint feel.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Star, Download, ArrowRight } from 'lucide-react';
import type { GalleryAgent } from './gallery-data';

interface Props {
  agent: GalleryAgent;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export const AgentCard = memo(function AgentCard({ agent, onClick, size = 'md' }: Props) {
  const isDraft = agent.status === 'draft';

  const sizeClasses = {
    sm: 'w-[140px]',
    md: 'w-[180px]',
    lg: 'w-full',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col text-left transition-all duration-300',
        'hover:-translate-y-1',
        sizeClasses[size],
      )}
    >
      {/* Icon area — the gradient IS the card */}
      <div
        className={cn(
          'relative flex aspect-square items-center justify-center rounded-[22px] bg-gradient-to-br transition-shadow duration-300',
          agent.gradient,
          isDraft && 'opacity-60 ring-1 ring-dashed ring-text-3/30',
          'group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
        )}
      >
        <span className={cn('transition-transform duration-300 group-hover:scale-110', size === 'sm' ? 'text-4xl' : 'text-5xl')}>
          {agent.icon}
        </span>

        {/* Draft indicator */}
        {isDraft && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-text-2 backdrop-blur-sm">
            Draft
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-[13px] font-semibold text-text-1">{agent.name}</h3>
        <p className="truncate text-[11px] text-text-3">{agent.subtitle}</p>

        {/* Stats row */}
        {!isDraft && agent.rating && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-text-3">
            <span className="flex items-center gap-0.5">
              <Star className="size-2.5 fill-current text-yellow-500" />
              {agent.rating.toFixed(1)}
            </span>
            {agent.installs && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Download className="size-2.5" />
                  {formatNumber(agent.installs)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
});

/**
 * Featured agent card — larger, with description. Used in hero sections.
 */
export const FeaturedAgentCard = memo(function FeaturedAgentCard({ agent, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-5 rounded-2xl bg-bg-card/50 p-4 text-left transition-all hover:bg-bg-card"
    >
      {/* Icon */}
      <div
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br',
          agent.gradient,
        )}
      >
        <span className="text-3xl">{agent.icon}</span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-text-1">{agent.name}</h3>
        <p className="mt-0.5 text-xs text-text-3">{agent.subtitle}</p>
        {agent.rating && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text-3">
            <span className="flex items-center gap-0.5">
              <Star className="size-3 fill-current text-yellow-500" />
              {agent.rating.toFixed(1)}
            </span>
            {agent.installs && (
              <span>{formatNumber(agent.installs)} installs</span>
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        <div className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
          <ArrowRight className="size-4" />
        </div>
      </div>
    </button>
  );
});

/**
 * Compact agent row — used in lists and search results.
 */
export const AgentRow = memo(function AgentRow({ agent, onClick }: Omit<Props, 'size'>) {
  const isDraft = agent.status === 'draft';

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-bg-card/60"
    >
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
          agent.gradient,
          isDraft && 'opacity-60',
        )}
      >
        <span className="text-xl">{agent.icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-1">{agent.name}</span>
          {isDraft && (
            <span className="rounded-full border border-text-3/30 px-1.5 py-px text-[9px] text-text-3">Draft</span>
          )}
        </div>
        <p className="truncate text-xs text-text-3">{agent.subtitle}</p>
      </div>

      {!isDraft && agent.rating && (
        <div className="flex shrink-0 items-center gap-1 text-[11px] text-text-3">
          <Star className="size-3 fill-current text-yellow-500" />
          {agent.rating.toFixed(1)}
        </div>
      )}
    </button>
  );
});
